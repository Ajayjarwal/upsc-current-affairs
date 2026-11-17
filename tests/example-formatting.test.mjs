import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { build } from 'esbuild';
// LinkeDOM requires the document shell that browsers add to HTML fragments.
class BrowserDOMParser extends DOMParser {
 parseFromString(value,type){return super.parseFromString(type==='text/html'&&!/<html(?:\s|>)/i.test(value)?'<html><head></head><body>'+value+'</body></html>':value,type);}
}
globalThis.DOMParser=BrowserDOMParser;
globalThis.document=new BrowserDOMParser().parseFromString('<html><body></body></html>','text/html');
const bundle=await build({entryPoints:['app/example-text.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {exampleFormatting,exampleBody}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const base={id:'format-test',title:'Sanitation',subjects:['Society & Social Justice'],gsPaper:['GS II'],tags:['Sanitation'],newsDate:'2026-11-17',status:'Unread',bookmarked:false,summary:'',sourceName:'WHO, UNICEF, 2024',sourceUrl:''};

test('bold, italic and underline survive saving, JSON storage, reopening, and resaving',()=>{
 const input='<p><strong>2.1 billion</strong> lacked <em>drinking water</em> and <u><b>3.4 billion</b></u> lacked sanitation.</p>';
 const formatted=exampleFormatting(input);
 assert.equal(formatted.text,'2.1 billion lacked drinking water and 3.4 billion lacked sanitation.');
 for(const token of ['<strong>2.1 billion</strong>','<em>drinking water</em>','<u><b>3.4 billion</b></u>'])assert.ok(formatted.html.includes(token));
 const saved=JSON.parse(JSON.stringify({...base,contentHtml:'<p>'+formatted.html+'</p>'}));
 const reopened=exampleBody(saved);
 assert.equal(reopened.html,formatted.html);
 assert.equal(reopened.source,base.sourceName);
 assert.equal(exampleFormatting('<p>'+reopened.html+'</p>').html,reopened.html);
});
test('formatting removes executable HTML, attributes and unsupported styling',()=>{
 const cleaned=exampleFormatting('<p onclick="alert(1)"><b style="color:red" onmouseover="alert(1)">Safe</b> <i>text</i><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)"><iframe src="https://example.test"></iframe><a href="javascript:alert(1)"><u>link text</u></a></p>');
 assert.equal(cleaned.text,'Safe textlink text');
 assert.equal(cleaned.html,'<b>Safe</b> <i>text</i><u>link text</u>');
 assert.doesNotMatch(cleaned.html,/script|iframe|onerror|onclick|style=|href=/i);
});
test('legacy section labels and duplicate sources are removed without removing emphasis',()=>{
 const body=exampleBody({...base,contentHtml:'<h2>Example</h2><p><b>A fact</b> about <i>water</i>.</p><p>Source: WHO, UNICEF, 2024</p>'});
 assert.equal(body.text,'A fact about water.');
 assert.equal(body.html,'<b>A fact</b> about <i>water</i>.');
 assert.equal(body.source,base.sourceName);
});
test('line breaks and unformatted existing examples remain readable',()=>{
 const body=exampleBody({...base,contentHtml:'<p>First line &amp; context.</p><p><u>Second line.</u></p>'});
 assert.equal(body.text,'First line & context.\nSecond line.');
 assert.equal(body.html,'First line &amp; context.<br><u>Second line.</u>');
 assert.equal(exampleFormatting('<p><br></p>').text,'');
});
