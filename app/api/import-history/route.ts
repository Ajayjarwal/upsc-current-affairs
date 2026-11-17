import { env } from 'cloudflare:workers';
import { getCurrentUser } from '../../auth';
import { z } from 'zod';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function context(req:Request,write=false){
 const user=await getCurrentUser();if(!user)throw new Error('AUTH');
 if(write&&req.headers.get('origin')!==new URL(req.url).origin)throw new Error('ORIGIN');
 if(!env.DB)throw new Error('STORAGE');
 return {db:env.DB,userId:user.userId};
}
function failure(error:unknown){
 if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'Invalid import history request.'},400);
 if(error instanceof Error&&error.message==='AUTH')return json({error:'Please sign in to view import history.'},401);
 if(error instanceof Error&&error.message==='ORIGIN')return json({error:'Request origin did not match.'},403);
 console.error('Import history request failed',error);
 return json({error:'Import history could not be loaded or updated. Please try again.'},503);
}
export async function GET(req:Request){
 try{
  const {db,userId}=await context(req),params=new URL(req.url).searchParams;
  const page=z.coerce.number().int().min(1).max(100000).parse(params.get('page')||1);
  const collection=z.enum(['all','articles','examples']).parse(params.get('collection')||'all');
  const condition=collection==='all'?'user_id=?':'user_id=? AND collection=?';
  const values=collection==='all'?[userId]:[userId,collection];
  const result=await db.batch([
   db.prepare(`SELECT id,collection,source_name AS sourceName,created_at AS createdAt,requested_count AS requestedCount,inserted_count AS insertedCount,
    CASE WHEN collection='articles' THEN (SELECT COUNT(*) FROM articles WHERE articles.user_id=import_batches.user_id AND import_batch_id=import_batches.id)
    ELSE (SELECT COUNT(*) FROM examples WHERE examples.user_id=import_batches.user_id AND import_batch_id=import_batches.id) END AS remainingCount
    FROM import_batches WHERE ${condition} ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?`).bind(...values,(page-1)*20),
   db.prepare(`SELECT COUNT(*) AS total FROM import_batches WHERE ${condition}`).bind(...values),
  ]);
  const total=(result[1].results[0] as {total:number}).total;
  return json({batches:result[0].results,total,page,hasMore:page*20<total});
 }catch(error){return failure(error);}
}
export async function DELETE(req:Request){
 try{
  const {db,userId}=await context(req,true);
  const raw=await req.text();if(raw.length>2000)return json({error:'Request too large.'},413);
  const {id,mode}=z.object({id:z.string().uuid(),mode:z.enum(['history','items'])}).parse(JSON.parse(raw));
  const batch=await db.prepare('SELECT collection FROM import_batches WHERE user_id=? AND id=?').bind(userId,id).first<{collection:'articles'|'examples'}>();
  if(!batch)return json({error:'This import was already removed or could not be found.'},404);
  const results=await db.batch([
   db.prepare(mode==='items'?`DELETE FROM ${batch.collection} WHERE user_id=? AND import_batch_id=?`:`UPDATE ${batch.collection} SET import_batch_id=NULL WHERE user_id=? AND import_batch_id=?`).bind(userId,id),
   db.prepare('DELETE FROM import_batches WHERE user_id=? AND id=?').bind(userId,id),
  ]);
  return json({ok:true,deletedCount:mode==='items'?results[0].meta.changes||0:0});
 }catch(error){return failure(error);}
}
