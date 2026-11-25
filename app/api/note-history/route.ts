import { env } from 'cloudflare:workers';
import { getCurrentUser } from '../../auth';
import { articleSchema } from '../../model';
import { z } from 'zod';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 try{
  const user=await getCurrentUser();if(!user)return json({error:'Please sign in.'},401);
  const db=env.DB;if(!db)throw new Error('Storage unavailable');
  const params=new URL(request.url).searchParams;
  const collection=z.enum(['articles','examples']).parse(params.get('collection'));
  const entryId=z.string().min(1).max(100).parse(params.get('entryId'));
  const current=await db.prepare(`SELECT data,created_at,updated_at FROM ${collection} WHERE user_id=? AND id=?`).bind(user.userId,entryId).first<{data:string;created_at:string;updated_at:string}>();
  if(!current)return json({error:'This entry could not be found.'},404);
  if(params.has('version')){
   const version=z.coerce.number().int().positive().parse(params.get('version'));
   const row=await db.prepare('SELECT id,data,saved_at AS savedAt FROM note_versions WHERE user_id=? AND collection=? AND entry_id=? AND id=?').bind(user.userId,collection,entryId,version).first<{id:number;data:string;savedAt:string}>();
   return row?json({id:row.id,savedAt:row.savedAt,entry:articleSchema.parse(JSON.parse(row.data))}):json({error:'Version not found.'},404);
  }
  const page=z.coerce.number().int().min(1).max(100000).parse(params.get('page')||1);
  const rows=await db.prepare('SELECT id,saved_at AS savedAt,archived_at AS archivedAt FROM note_versions WHERE user_id=? AND collection=? AND entry_id=? ORDER BY id DESC LIMIT 21 OFFSET ?').bind(user.userId,collection,entryId,(page-1)*20).all();
  return json({versions:rows.results.slice(0,20),hasMore:rows.results.length>20,current:{...articleSchema.parse(JSON.parse(current.data)),createdAt:current.created_at,updatedAt:current.updated_at}});
 }catch(error){if(error instanceof z.ZodError)return json({error:'Invalid history request.'},400);console.error('Note history failed');return json({error:'Could not load version history. Please try again.'},503);}
}
