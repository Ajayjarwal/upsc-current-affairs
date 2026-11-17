import { safeHtml } from './sanitize';
import type { Article } from './model';
export function exampleFormatting(html:string):{text:string;html:string} {
 if(typeof document==='undefined')return {text:'',html:''};
 const doc=new DOMParser().parseFromString(safeHtml(html),'text/html');
 const inline=new Set(['B','STRONG','I','EM','U','BR']);
 const blocks=new Set(['P','DIV','H2','H3','H4','LI','BLOCKQUOTE','TR','HR']);
 function walk(parent:Element){
  for(const element of Array.from(parent.children)){
   walk(element);
   if(inline.has(element.tagName)){
    for(const attribute of Array.from(element.attributes))element.removeAttribute(attribute.name);
   }else{
    const children=Array.from(element.childNodes);
    element.replaceWith(...children,...(blocks.has(element.tagName)?[doc.createElement('br')]:[]));
   }
  }
 }
 walk(doc.body);
 const formatted=doc.body.innerHTML.replace(/(?:<br>\s*){3,}/g,'<br><br>').replace(/^(?:\s*<br>)+|(?:<br>\s*)+$/g,'').trim();
 doc.body.innerHTML=formatted;
 doc.querySelectorAll('br').forEach(node=>node.replaceWith('\n'));
 const text=(doc.body.textContent??'').replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 return {text,html:formatted};
}
export function exampleBody(entry:Article):{text:string;html:string;source:string} {
 if(typeof document==='undefined')return {text:'',html:'',source:entry.sourceName};
 const doc=new DOMParser().parseFromString(safeHtml(entry.contentHtml),'text/html');
 doc.querySelectorAll('h2,h3,h4').forEach(heading=>{
  if(/^(example|key facts|use in an answer|where could i use this\??)$/i.test(heading.textContent?.trim()??''))heading.remove();
 });
 let source=entry.sourceName;
 // Older imports place the source in both the body and its own field.
 doc.querySelectorAll('p,div').forEach(node=>{
  const text=node.textContent?.trim()??'';
  if(/^source\s*:/i.test(text)&&!node.querySelector('p,div')){source ||= text.replace(/^source\s*:\s*/i,'');node.remove();}
 });
 const formatted=exampleFormatting(doc.body.innerHTML);
 const body=formatted.text?formatted:exampleFormatting(textMarkup(entry.summary||entry.title));
 return {...body,source};
}
export function textMarkup(text:string):string {
 const escaped=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 return '<p>'+escaped.replace(/\r?\n/g,'<br>')+'</p>';
}
