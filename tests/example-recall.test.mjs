import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle=await build({entryPoints:['app/example-recall.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {reviewExample,isDue,currentRecall,prioritiseExamples,parseRecallProgress,recallCue}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const textBundle=await build({entryPoints:['app/example-text.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {textMarkup}=await import('data:text/javascript;base64,'+Buffer.from(textBundle.outputFiles[0].text).toString('base64'));
const entry={id:'water',title:'Water',contentHtml:'<p>A short example.</p>',sourceName:'Source, 2024',sourceUrl:'',subjects:['General'],gsPaper:['GS II'],tags:['Water'],summary:'',newsDate:'2026-11-17',status:'Unread',bookmarked:false};
const now=Date.UTC(2026,10,17,8);
const day=86400000;
test('new examples are due; self-ratings set appropriate next reviews and survive serialization',()=>{
 assert.equal(isDue(entry,{},now),true);
 const forgot=reviewExample(entry,undefined,'forgot',now);
 assert.equal(forgot.dueAt,now+10*60*1000);
 assert.equal(isDue(entry,{water:forgot},now),false);
 assert.equal(isDue(entry,{water:forgot},forgot.dueAt),true);
 const partly=reviewExample(entry,forgot,'partly',now);
 assert.equal(partly.dueAt,now+day);
 const remembered=reviewExample(entry,partly,'remembered',now);
 const again=reviewExample(entry,remembered,'remembered',now+day);
 assert.equal(again.dueAt,now+4*day);
 assert.equal(again.streak,2);
 assert.deepEqual(parseRecallProgress(JSON.stringify({water:again})),{water:again});
 assert.equal(reviewExample(entry,again,'forgot',now).streak,0);
});
test('editing the facts or source restarts recall while bookmarks and tags preserve history',()=>{
 const remembered=reviewExample(entry,undefined,'remembered',now);
 assert.equal(currentRecall({...entry,contentHtml:'<p>Changed fact.</p>'},{water:remembered}),undefined);
 assert.equal(isDue({...entry,sourceName:'A different source'},{water:remembered},now),true);
 assert.deepEqual(currentRecall({...entry,bookmarked:true,tags:['Updated topic']},{water:remembered}),remembered);
});
test('due forgotten examples precede new examples; future reviews are last and entries are not mutated',()=>{
 const forgotten={...entry,id:'forgotten'},future={...entry,id:'future'};
 const entries=[future,entry,forgotten];
 const progress={forgotten:reviewExample(forgotten,undefined,'forgot',now-day),future:reviewExample(future,undefined,'remembered',now)};
 assert.deepEqual(prioritiseExamples(entries,progress,now).map(x=>x.id),['forgotten','water','future']);
 assert.deepEqual(entries.map(x=>x.id),['future','water','forgotten']);
});
test('damaged or invalid browser history is safely ignored',()=>{
 for(const value of ['broken','null','[]','{"water":{"grade":"other"}}'])assert.deepEqual(parseRecallProgress(value),{});
});
test('plain example editing escapes HTML and preserves line breaks',()=>{
 assert.equal(textMarkup('A <script>alert("x")</script>\nSource & context'),'<p>A &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br>Source &amp; context</p>');
});

test('custom recall questions override the automatic cue, and blank questions restore it',()=>{
 assert.equal(recallCue(entry),'Water');
 assert.equal(recallCue({...entry,recallQuestion:'  What does this example demonstrate?  '}),'What does this example demonstrate?');
 assert.equal(recallCue({...entry,recallQuestion:'  '}),'Water');
 assert.equal(recallCue({...entry,tags:[]}),'General');
});
test('changing a custom question restarts recall without resetting legacy blank-question history',()=>{
 const remembered=reviewExample(entry,undefined,'remembered',now);
 assert.deepEqual(currentRecall({...entry,recallQuestion:''},{water:remembered}),remembered);
 assert.deepEqual(currentRecall({...entry,recallQuestion:'   '},{water:remembered}),remembered);
 const changed={...entry,recallQuestion:'How does this improve sanitation?'};
 assert.equal(currentRecall(changed,{water:remembered}),undefined);
 const reviewed=reviewExample(changed,remembered,'remembered',now+day);
 assert.equal(reviewed.streak,1);
 assert.equal(currentRecall({...changed,recallQuestion:''},{water:reviewed}),undefined);
 assert.deepEqual(currentRecall({...changed,bookmarked:true},{water:reviewed}),reviewed);
});
