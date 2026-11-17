import { safeHtml } from './sanitize';
import type { Article } from './model';
export function exampleBody(entry:Article):{text:string;source:string} {
 if(typeof document==='undefined')return {text:'',source:entry.sourceName};
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
 doc.querySelectorAll('br').forEach(node=>node.replaceWith('\n'));
 doc.querySelectorAll('p,li,h2,h3,h4,blockquote').forEach(node=>node.append('\n'));
 const text=(doc.body.textContent??'').replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 return {text:text||entry.summary||entry.title,source};
}
export function textMarkup(text:string):string {
 const escaped=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 return '<p>'+escaped.replace(/\r?\n/g,'<br>')+'</p>';
}
