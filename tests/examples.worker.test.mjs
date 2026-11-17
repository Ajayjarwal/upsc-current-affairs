import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Exercise the real route handlers and D1 SQL with test-only authentication.
test('examples keep their own records and tags, enforce ownership, and support edit/import/delete', async () => {
  const root = new URL('../', import.meta.url).pathname;
  const bundle = await build({
    stdin: {resolveDir: root, contents: `
      import * as examples from './app/api/examples/route.ts';
      import * as articles from './app/api/articles/route.ts';
      import { setUser } from 'test-auth';
      export default {async fetch(request) {
        setUser(request.headers.get('x-test-user'));
        const route = new URL(request.url).pathname === '/api/examples' ? examples : articles;
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
    for(const file of ['0000_current_affairs.sql','0003_examples.sql']) await db.prepare(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8')).run();
    const example={id:'same-id',title:'Community sanitation initiative',subjects:['Society & Social Justice','Polity & Governance'],gsPaper:['GS II','GS IV'],tags:['Water & sanitation','Poverty'],contentHtml:'<p>A supplied example for a mains answer.</p>'};
    assert.equal((await send('/api/examples','GET',null,null)).status,401);
    assert.equal((await send('/api/examples','POST',{examples:[example]},'owner','https://other.test')).status,403);
    assert.equal((await send('/api/examples','POST',{examples:[{...example,gsPaper:[]}]})).status,400);
    assert.equal((await send('/api/examples','POST',{examples:[{...example,gsPaper:['Prelims']}]})).status,400);
    assert.equal((await send('/api/examples','POST',{examples:[{...example,subjects:['Not a subject']}]})).status,400);
    assert.deepEqual((await send('/api/examples','POST',{examples:[example]})).data,{inserted:1});
    assert.deepEqual((await send('/api/examples','POST',{examples:[example]})).data,{inserted:0});
    const news={...example,newsDate:'2026-11-17',tags:['Current affairs only']};
    assert.deepEqual((await send('/api/articles','POST',{articles:[news]})).data,{inserted:1});
    const saved=(await send('/api/examples')).data.examples[0];
    assert.deepEqual(saved.tags,example.tags);
    assert.deepEqual(saved.gsPaper,example.gsPaper);
    assert.match(saved.newsDate,/^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual((await send('/api/articles')).data.articles[0].tags,['Current affairs only']);
    assert.equal((await send('/api/examples','GET',null,'other')).data.examples.length,0);
    assert.equal((await send('/api/examples','PUT',{example:{...saved,title:'Not permitted'},expectedUpdatedAt:saved.updatedAt},'other')).status,409);
    assert.equal((await send('/api/examples','PUT',{example:{...saved,title:'Updated example',tags:['Sanitation']},expectedUpdatedAt:'stale'})).status,409);
    assert.equal((await send('/api/examples','PUT',{example:{...saved,title:'Updated example',tags:['Sanitation']},expectedUpdatedAt:saved.updatedAt})).status,200);
    assert.equal((await send('/api/examples')).data.examples[0].title,'Updated example');
    await send('/api/examples','DELETE',{id:saved.id},'other');
    assert.equal((await send('/api/examples')).data.examples.length,1);
    await send('/api/examples','DELETE',{id:saved.id});
    assert.equal((await send('/api/examples')).data.examples.length,0);
    assert.equal((await send('/api/articles')).data.articles.length,1);
  }finally{await worker.dispose();}
});
