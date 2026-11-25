import { env } from 'cloudflare:workers';
import { getCurrentUser } from '../../auth';
import { exampleSchema } from '../../example-model';
import { z } from 'zod';
import { importMetadataSchema, recordImport } from '../../import-history-store';
export const dynamic = 'force-dynamic';
const json = (v:unknown,status=200) => Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function context(req:Request,write=false) {
  const user=await getCurrentUser();
  if(!user) throw new Error('AUTH');
  if(write && req.headers.get('origin')!==new URL(req.url).origin) throw new Error('ORIGIN');
  if(!env.DB) throw new Error('STORAGE');
  return {db:env.DB,userId:user.userId};
}
async function body(req:Request) { const s=await req.text(); if(new TextEncoder().encode(s).length>3000000) throw new Error('SIZE'); return JSON.parse(s); }
function failure(e:unknown) {
  if(e instanceof z.ZodError) return json({error:e.issues.map(i=>i.path.join('.')+': '+i.message).join('; ')},400);
  const m=e instanceof Error?e.message:'';
  if(m==='AUTH') return json({error:'Please sign in to access your examples.'},401);
  if(m==='ORIGIN') return json({error:'Request origin did not match.'},403);
  if(m==='SIZE') return json({error:'Import is too large. Split it into files smaller than 3 MB.'},413);
  if(e instanceof SyntaxError) return json({error:'Invalid JSON.'},400);
  console.error('Example storage request failed',e);
  return json({error:'Your examples could not be saved or loaded. Please try again.'},503);
}
export async function GET(req:Request) {
  try { const {db,userId}=await context(req); const r=await db.prepare('SELECT data, created_at, updated_at FROM examples WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all<{data:string;created_at:string;updated_at:string}>();
    return json({examples:r.results.map(x=>({...exampleSchema.parse(JSON.parse(x.data)),createdAt:x.created_at,updatedAt:x.updated_at}))});
  } catch(e) {return failure(e);}
}
export async function POST(req:Request) {
  try { const {db,userId}=await context(req,true); const input=z.object({examples:z.array(exampleSchema).min(1).max(100),import:importMetadataSchema.optional()}).parse(await body(req));
    if(input.import)return json({inserted:await recordImport(db,userId,'examples',input.examples,input.import.sourceName)});
    const now=new Date().toISOString();
    const r=await db.batch(input.examples.map(a=>db.prepare('INSERT OR IGNORE INTO examples (id,user_id,data,created_at,updated_at) VALUES (?,?,?,?,?)').bind(a.id,userId,JSON.stringify(a),now,now)));
    return json({inserted:r.reduce((n,x)=>n+(x.meta.changes||0),0)});
  } catch(e) {return failure(e);}
}
export async function PUT(req:Request) {
  try { const {db,userId}=await context(req,true); const {example,expectedUpdatedAt}=z.object({example:exampleSchema,expectedUpdatedAt:z.string().min(1)}).parse(await body(req));
    const previous=Date.parse(expectedUpdatedAt);
    const now=new Date(Math.max(Date.now(),Number.isFinite(previous)?previous+1:0)).toISOString();
    const r=await db.prepare('UPDATE examples SET data=?, updated_at=? WHERE id=? AND user_id=? AND updated_at=?').bind(JSON.stringify(example),now,example.id,userId,expectedUpdatedAt).run();
    if(!r.meta.changes) return json({error:'This example changed in another tab. Close the editor and reload before editing again.'},409);
    return json({updatedAt:now});
  } catch(e) {return failure(e);}
}
export async function DELETE(req:Request) {
  try { const {db,userId}=await context(req,true); const {id}=z.object({id:z.string().min(1).max(100)}).parse(await body(req));
    await db.prepare('DELETE FROM examples WHERE id=? AND user_id=?').bind(id,userId).run(); return json({ok:true});
  } catch(e) {return failure(e);}
}
