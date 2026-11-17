import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

test('import history tracks exact user-owned batches and safely deletes history or imported records',async()=>{
 const root=new URL('../',import.meta.url).pathname;
 const bundle=await build({
  stdin:{resolveDir:root,contents:`
   import * as articles from './app/api/articles/route.ts';
   import * as examples from './app/api/examples/route.ts';
   import * as history from './app/api/import-history/route.ts';
   import {setUser} from 'test-auth';
   export default {async fetch(request){
    setUser(request.headers.get('x-test-user'));
    const path=new URL(request.url).pathname;
    const route=path==='/api/articles'?articles:path==='/api/examples'?examples:history;
    return route[request.method](request);
   }};
  `},bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers'],
  plugins:[{name:'test-auth',setup(b){
   b.onResolve({filter:/^(test-auth|\.\.\/\.\.\/auth)$/},()=>({path:'auth',namespace:'test-auth'}));
   b.onLoad({filter:/.*/,namespace:'test-auth'},()=>({contents:'let user;export function setUser(id){user=id?{userId:id}:null;}export async function getCurrentUser(){return user;}'}));
  }}],
 });
 const worker=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',d1Databases:['DB']});
 const send=async(path,method='GET',body,user='owner',origin='https://desk.test')=>{
  const response=await worker.dispatchFetch('https://desk.test'+path,{method,headers:{...(user?{'x-test-user':user}:{}),origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json()};
 };
 const entry=id=>({id,title:'Example '+id,subjects:['General'],gsPaper:['GS II'],tags:['Water'],contentHtml:'<p>Example text.</p>',newsDate:'2026-11-17'});
 const load=async(user='owner')=>(await send('/api/import-history','GET',null,user)).data;
 try{
  const db=await worker.getD1Database('DB');
  for(const file of ['0000_current_affairs.sql','0003_examples.sql'])await db.prepare(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8')).run();
  await send('/api/articles','POST',{articles:[entry('old-note')]});
  const migration=await readFile(new URL('../drizzle/0004_import_history.sql',import.meta.url),'utf8');
  await db.batch(migration.split(';').filter(sql=>sql.trim()).map(sql=>db.prepare(sql)));
  assert.equal((await load()).total,0);
  assert.equal((await send('/api/articles')).data.articles.length,1,'migration preserves old notes');
  assert.equal((await send('/api/import-history','GET',null,null)).status,401);
  assert.equal((await send('/api/import-history?page=0')).status,400);
  assert.equal((await send('/api/import-history?collection=other')).status,400);
  assert.equal((await send('/api/examples','POST',{examples:[entry('manual')]})).status,200);
  assert.equal((await load()).total,0,'manual adds are not imports');
  const input={examples:[entry('first'),entry('manual')],import:{sourceName:'examples.json'}};
  assert.deepEqual((await send('/api/examples','POST',input)).data,{inserted:1});
  const batch=(await load()).batches[0];
  assert.deepEqual([batch.sourceName,batch.collection,batch.requestedCount,batch.insertedCount,batch.remainingCount],['examples.json','examples',2,1,1]);
  assert.equal((await load('other')).total,0,'history is private');
  assert.equal((await send('/api/import-history?collection=articles')).data.total,0);
  assert.equal((await send('/api/import-history?collection=examples')).data.total,1);
  assert.equal((await send('/api/import-history','DELETE',{id:batch.id,mode:'items'},'other')).status,404);
  assert.equal((await send('/api/import-history','DELETE',{id:batch.id,mode:'items'},'owner','https://other.test')).status,403);
  assert.equal((await send('/api/import-history','DELETE',{id:batch.id,mode:'all'})).status,400);
  await send('/api/examples','POST',{examples:[entry('first')],import:{sourceName:'duplicates.json'}});
  const duplicate=(await load()).batches.find(value=>value.sourceName==='duplicates.json');
  assert.equal(duplicate.insertedCount,0);assert.equal(duplicate.remainingCount,0);
  await send('/api/import-history','DELETE',{id:duplicate.id,mode:'items'});
  assert.equal((await send('/api/examples')).data.examples.length,2,'deleting duplicate batch keeps earlier entries');
  await send('/api/examples','POST',{examples:[entry('first')]},'other');
  await send('/api/articles','POST',{articles:[entry('first')]});
  const first=(await send('/api/examples')).data.examples.find(item=>item.id==='first');
  await send('/api/examples','PUT',{example:{...first,title:'Edited after import'},expectedUpdatedAt:first.updatedAt});
  assert.deepEqual((await send('/api/import-history','DELETE',{id:batch.id,mode:'items'})).data,{ok:true,deletedCount:1});
  assert.deepEqual((await send('/api/examples')).data.examples.map(item=>item.id),['manual']);
  assert.equal((await send('/api/examples','GET',null,'other')).data.examples.length,1,'other owner remains untouched');
  assert.equal((await send('/api/articles')).data.articles.length,2,'other collection remains untouched');
  await send('/api/examples','POST',{examples:[entry('recreated')],import:{sourceName:'recreated.json'}});
  const old=(await load()).batches[0];
  await send('/api/examples','DELETE',{id:'recreated'});
  await send('/api/examples','POST',{examples:[entry('recreated')]});
  assert.equal((await send('/api/import-history','DELETE',{id:old.id,mode:'items'})).data.deletedCount,0);
  assert.ok((await send('/api/examples')).data.examples.some(item=>item.id==='recreated'),'later recreation is not part of old import');
  await send('/api/articles','POST',{articles:[entry('keep-note')],import:{sourceName:'Pasted JSON'}});
  const keep=(await load()).batches[0];
  assert.deepEqual((await send('/api/import-history','DELETE',{id:keep.id,mode:'history'})).data,{ok:true,deletedCount:0});
  assert.ok((await send('/api/articles')).data.articles.some(item=>item.id==='keep-note'));
  assert.equal((await db.prepare('SELECT import_batch_id FROM articles WHERE user_id=? AND id=?').bind('owner','keep-note').first()).import_batch_id,null);
  assert.equal((await send('/api/import-history','DELETE',{id:keep.id,mode:'items'})).status,404);
  await db.exec("CREATE TRIGGER fail_test_import BEFORE INSERT ON examples WHEN NEW.id='fail-transaction' BEGIN SELECT RAISE(ABORT,'test rollback'); END;");
  const before=await load();
  assert.equal((await send('/api/examples','POST',{examples:[entry('should-rollback'),entry('fail-transaction')],import:{sourceName:'failed.json'}})).status,503);
  assert.equal((await load()).total,before.total,'failed transaction leaves no history');
  assert.ok(!(await send('/api/examples')).data.examples.some(item=>item.id==='should-rollback'),'partial inserts roll back');
  for(let i=0;i<21;i++)await send('/api/articles','POST',{articles:[entry('page-'+i)],import:{sourceName:'page-'+i+'.json'}},'pager');
  const page1=await load('pager'),page2=(await send('/api/import-history?page=2','GET',null,'pager')).data;
  assert.equal(page1.total,21);assert.equal(page1.batches.length,20);assert.equal(page1.hasMore,true);
  assert.equal(page2.batches.length,1);assert.equal(page2.hasMore,false);
  assert.equal(new Set([...page1.batches,...page2.batches].map(batch=>batch.id)).size,21);
 }finally{await worker.dispose();}
});
