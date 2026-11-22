import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { DOMParser } from 'linkedom';
class BrowserDOMParser extends DOMParser{
 parseFromString(value,type){return super.parseFromString(type==='text/html'&&!/<html(?:\s|>)/i.test(value)?'<html><head></head><body>'+value+'</body></html>':value,type);}
}
globalThis.DOMParser=BrowserDOMParser;
globalThis.document=new BrowserDOMParser().parseFromString('<html><body></body></html>','text/html');
const bundle=await build({stdin:{resolveDir:process.cwd(),contents:"export * from './app/pdf-document.ts';export * from './app/pdf-export-model.ts';"},bundle:true,write:false,format:'esm',platform:'node'});
const {buildPdfDocument,defaultPdfSettings,selectPdfEntries,pdfGroups}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const base={id:'one',title:'Water access',subjects:['Society & Social Justice','Economy'],gsPaper:['GS II'],tags:['SHOULD_NOT_EXPORT'],newsDate:'2026-11-22',summary:'',recallQuestion:'How many people lacked safe water?',contentHtml:'<p><b>Important fact</b> with <i>context</i> and <u>evidence</u>.</p>',sourceName:'WHO, UNICEF, 2024',sourceUrl:'https://example.test/report',status:'Unread',bookmarked:false};
const defaults=defaultPdfSettings();
function parse(html){return new BrowserDOMParser().parseFromString(html,'text/html');}

test('include and exclude modes handle multiple subjects without duplicate exports',()=>{
 const entries=[base,{...base,id:'two',title:'Farming',subjects:['Agriculture']},{...base,id:'three',title:'Growth',subjects:['Economy']}];
 assert.equal(selectPdfEntries(entries,defaults).length,3);
 assert.deepEqual(selectPdfEntries(entries,{...defaults,subjectMode:'include',subjects:['Society & Social Justice']}).map(entry=>entry.id),['one']);
 assert.deepEqual(selectPdfEntries(entries,{...defaults,subjectMode:'exclude',subjects:['Society & Social Justice']}).map(entry=>entry.id),['two','three']);
 const groups=pdfGroups(entries,{...defaults,subjectMode:'include',subjects:['Society & Social Justice','Economy']});
 assert.deepEqual(groups.map(group=>group.subject),['Economy']);
 assert.equal(groups.flatMap(group=>group.entries).length,2);
 assert.equal(pdfGroups(entries,{...defaults,groupBySubject:false})[0].entries.length,3);
 assert.equal(entries[0].subjects[0],'Society & Social Justice','input is not mutated');
});
test('combined PDF keeps sections and emphasis, omits tags and GS badges, includes sources',()=>{
 const html=buildPdfDocument({articles:[base],examples:[{...base,id:'example'}]},{...defaults,collection:'both'},'https://desk.test',new Date('2026-11-22T06:00:00Z'));
 const doc=parse(html);
 assert.equal(doc.querySelectorAll('section.collection').length,2);
 assert.equal(doc.querySelectorAll('article.entry').length,2);
 assert.equal(doc.querySelectorAll('.entry-title').length,2);
 for(const selector of ['b','i','u'])assert.ok(doc.querySelector('.prose '+selector));
 assert.equal(doc.querySelectorAll('.source').length,2);
 assert.match(doc.querySelector('.source').textContent,/WHO, UNICEF, 2024/);
 assert.doesNotMatch(html,/SHOULD_NOT_EXPORT|GS II/);
 assert.equal(doc.querySelectorAll('.recall-question').length,0);
 assert.match(doc.querySelector('script').getAttribute('src'),/^https:\/\/desk.test\/pdf-print.js$/);
});
test('images and merged table headers survive export, and images can be excluded',()=>{
 const item={...base,contentHtml:'<p>A short example.</p><figure><img src="data:image/png;base64,aGVsbG8=" alt="Water chart"><figcaption>Water chart</figcaption></figure><table><tbody><tr><th colspan="2">Comparison</th></tr><tr><td rowspan="2">2024</td><td>One</td></tr><tr><td>Two</td></tr></tbody></table><p>Source: WHO, UNICEF, 2024</p>'};
 const settings={...defaults,collection:'examples'};
 const doc=parse(buildPdfDocument({articles:[],examples:[item]},settings,'https://desk.test'));
 assert.equal(doc.querySelector('.prose img').getAttribute('loading'),'eager');
 assert.equal(doc.querySelector('.prose figcaption').textContent,'Water chart');
 assert.equal(doc.querySelector('table thead th').getAttribute('colspan'),'2');
 assert.equal(doc.querySelector('table td[rowspan]').getAttribute('rowspan'),'2');
 assert.equal(doc.querySelectorAll('.source').length,1);
 assert.doesNotMatch(doc.querySelector('.prose').textContent,/Source:/);
 const noImages=parse(buildPdfDocument({articles:[],examples:[item]},{...settings,includeImages:false},'https://desk.test'));
 assert.equal(noImages.querySelectorAll('img,figure,figcaption').length,0);
 assert.equal(noImages.querySelectorAll('table').length,1);
});
test('layout, paper size and palettes produce bounded print styles with selectable text',()=>{
 for(const orientation of ['portrait','landscape'])for(const columns of [1,2])for(const palette of ['warm','navy','forest','monochrome']){
  const html=buildPdfDocument({articles:[base],examples:[]},{...defaults,orientation,columns,palette,paper:'Letter'},'https://desk.test');
  assert.match(html,new RegExp('size:Letter '+orientation));
  assert.match(html,new RegExp('column-count:'+columns));
  assert.match(html,/thead\{display:table-header-group\}/);
  assert.match(html,/@media print/);
  assert.match(html,/Important fact/);
 }
});
test('unsafe content and palette-conflicting styles are removed; custom questions are optional',()=>{
 const item={...base,title:'<script>bad title</script>',contentHtml:'<p style="color:white" onclick="bad()"><strong>Keep this</strong><script>bad()</script><img src="javascript:bad()"><iframe src="https://bad.test"></iframe></p><table><tr><td colspan="99999" rowspan="oops" onmouseover="bad()">Safe cell</td></tr></table>',sourceName:'Source <img src=x onerror=bad()>',sourceUrl:'javascript:bad()'};
 const html=buildPdfDocument({articles:[],examples:[item]},{...defaults,collection:'examples',includeRecallQuestions:true},'https://desk.test');
 const doc=parse(html);
 assert.equal(doc.querySelectorAll('script').length,1,'only the trusted print script remains');
 assert.equal(doc.querySelectorAll('iframe,[onclick],[onmouseover],[onerror],td[colspan],td[rowspan],.prose [style]').length,0);
 assert.equal(doc.querySelectorAll('img').length,0);
 assert.equal(doc.querySelectorAll('.source a').length,0);
 assert.equal(doc.querySelector('.recall-question').textContent,'Recall: '+base.recallQuestion);
 assert.match(doc.querySelector('.entry-title').textContent,/<script>bad title<\/script>/);
 assert.throws(()=>buildPdfDocument({articles:[],examples:[]},defaults,'https://desk.test'),/No entries/);
});

test('print controls wait for loaded images and enable the browser print action',async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const doc=parse('<html><body><button id="save-pdf" disabled>Save</button><p id="image-status"></p><button id="retry-images" hidden>Retry</button><main><img src="https://example.test/photo.png" alt="Diagram"></main></body></html>');
 const img=doc.querySelector('img');let ready=false,prints=0;
 Object.defineProperty(img,'complete',{get:()=>ready});Object.defineProperty(img,'naturalWidth',{get:()=>ready?100:0});
 const fontReady=Promise.resolve();Object.defineProperty(doc,'fonts',{value:{ready:fontReady}});
 runInNewContext(await readFile('public/pdf-print.js','utf8'),{document:doc,window:{print:()=>prints++},setTimeout,clearTimeout});
 assert.equal(doc.getElementById('save-pdf').disabled,true);
 ready=true;img.dispatchEvent(new doc.defaultView.Event('load'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(doc.getElementById('save-pdf').disabled,false);
 doc.getElementById('save-pdf').click();assert.equal(prints,1);
 assert.equal(doc.querySelectorAll('.missing-image').length,0);
});
test('failed images are marked clearly and a successful retry restores them before printing',async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const doc=parse('<html><body><button id="save-pdf" disabled>Save</button><p id="image-status"></p><button id="retry-images" hidden>Retry</button><main><img src="https://example.test/photo.png" alt="Diagram"></main></body></html>');
 const img=doc.querySelector('img');let width=0;
 Object.defineProperty(img,'complete',{value:true});Object.defineProperty(img,'naturalWidth',{get:()=>width});
 runInNewContext(await readFile('public/pdf-print.js','utf8'),{document:doc,window:{print:()=>{}},setTimeout,clearTimeout});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(img.hidden,true);assert.equal(doc.querySelectorAll('.missing-image').length,1);
 assert.match(doc.getElementById('image-status').textContent,/could not be loaded/);
 assert.equal(doc.getElementById('retry-images').hidden,false);
 width=100;doc.getElementById('retry-images').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(img.hidden,false);assert.equal(doc.querySelectorAll('.missing-image').length,0);
 assert.equal(doc.getElementById('save-pdf').disabled,false);
});
