import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Exercise the real route handlers and D1 SQL with test-only authentication.
test('note versions are atomic, private, restorable, and isolated by collection', async () => {
  const root = new URL('../', import.meta.url).pathname;
  const bundle = await build({
    stdin: {resolveDir: root, contents: `
      import * as examples from './app/api/examples/route.ts';
      import * as history from './app/api/note-history/route.ts';
      import * as articles from './app/api/articles/route.ts';
      import { setUser } from 'test-auth';
      export default {async fetch(request) {
        setUser(request.headers.get('x-test-user'));
        const path=new URL(request.url).pathname;const route=path==='/api/note-history'?history:path==='/api/examples'?examples:articles;
        return route[request.method](request);
      }};
    `},
    bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers'],
    plugins:[{name:'test-auth-only',setup(b){
      b.onResolve({filter:/^(test-auth|\.\.\/\.\.\/auth)$/},()=>({path:'auth',namespace:'test-auth'}));
      b.onLoad({filter:/.*/,namespace:'test-auth'},()=>({contents:`let user;export function setUser(id){user=id?{userId:id}:null;}export async function getCurrentUser(){return user;}`}));
    }}],
  });
  const worker=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',d1Databases:['DB']});
  const send=async (path,method='GET',body,user='owner',origin='https://desk.test')=>{
    const response=await worker.dispatchFetch('https://desk.test'+path,{method,headers:{...(user?{'x-test-user':user}:{}),origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  };
  try{
    const db=await worker.getD1Database('DB');
    for(const file of ['0000_current_affairs.sql','0003_examples.sql'])await db.prepare(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8')).run();
    const migration=await readFile(new URL('../drizzle/0006_note_history.sql',import.meta.url),'utf8');
    await db.batch(migration.split(/;\n(?=CREATE)/).map(sql=>db.prepare(sql.trim().replace(/;$/,'')+';')));
    const original={id:'history-entry',title:'Original',subjects:['Agriculture'],gsPaper:['GS II'],tags:['Water'],newsDate:'2026-11-25',contentHtml:'<p><b>Original fact</b></p>',recallQuestion:'Original question'};
    for(const collection of ['articles','examples']){
      const single=collection==='articles'?'article':'example';
      assert.equal((await send('/api/'+collection,'POST',{[collection]:[original]})).status,200);
      const first=(await send('/api/'+collection)).data[collection][0];
      const path='/api/note-history?collection='+collection+'&entryId='+original.id;
      assert.equal((await send(path,'GET',null,null)).status,401);
      assert.equal((await send(path,'GET',null,'other')).status,404);
      assert.equal((await send(path)).data.versions.length,0);
      const updated={...first,title:'Updated',contentHtml:'<p>New fact</p>'};
      assert.equal((await send('/api/'+collection,'PUT',{[single]:updated,expectedUpdatedAt:first.updatedAt})).status,200);
      let history=(await send(path)).data;
      assert.equal(history.versions.length,1);
      assert.ok(history.current.updatedAt>first.updatedAt);
      const id=history.versions[0].id;
      assert.equal((await send(path+'&version='+id,'GET',null,'other')).status,404);
      const saved=(await send(path+'&version='+id)).data.entry;
      assert.equal(saved.title,'Original');assert.equal(saved.contentHtml,original.contentHtml);assert.equal(saved.recallQuestion,original.recallQuestion);
      assert.equal((await send('/api/'+collection,'PUT',{[single]:first,expectedUpdatedAt:'stale'})).status,409);
      assert.equal((await send(path)).data.versions.length,1,'conflicted write adds no version');
      assert.equal((await send('/api/'+collection,'PUT',{[single]:saved,expectedUpdatedAt:history.current.updatedAt})).status,200);
      history=(await send(path)).data;
      assert.equal(history.current.title,'Original');assert.equal(history.versions.length,2);
      assert.equal((await send(path+'&version='+history.versions[0].id)).data.entry.title,'Updated','restore archives the displaced saved version');
    }
    const path='/api/note-history?collection=examples&entryId='+original.id;
    const before=(await send(path)).data;
    await send('/api/examples','DELETE',{id:original.id});
    assert.equal((await send(path)).status,404);
    await send('/api/examples','POST',{examples:[original]});
    assert.equal((await send(path)).data.versions.length,0,'recreated IDs do not inherit deleted history');
    assert.equal((await send('/api/note-history?collection=articles&entryId='+original.id)).data.versions.length,2,'other collection history remains');
    assert.equal((await send('/api/note-history?collection=wrong&entryId=x')).status,400);
  }finally{await worker.dispose();}
});
