import { safeImageSource } from './images';
const ALLOWED=new Set(['P','BR','STRONG','B','EM','I','U','S','H2','H3','H4','UL','OL','LI','BLOCKQUOTE','A','TABLE','THEAD','TBODY','TR','TH','TD','SPAN','DIV','HR','MARK','FONT','IMG','FIGURE','FIGCAPTION']);
export function safeHtml(html:string):string {
  if(typeof document==='undefined') return '';
  const doc=new DOMParser().parseFromString(html,'text/html');
  function walk(parent:Element) {
    for(const el of Array.from(parent.children)) {
      if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','FORM','INPUT','BUTTON','TEMPLATE'].includes(el.tagName)) {el.remove();continue;}
      walk(el);
      if(!ALLOWED.has(el.tagName)) {el.replaceWith(...Array.from(el.childNodes));continue;}
      const href=el.getAttribute('href'); const color=(el as HTMLElement).style.color || el.getAttribute('color'); const bg=(el as HTMLElement).style.backgroundColor;
      const imageSource=el.tagName==='IMG'?safeImageSource(el.getAttribute('src')):null;
      const imageAlt=el.getAttribute('alt')||'';
      if(el.tagName==='IMG'&&!imageSource){el.remove();continue;}
      for(const a of Array.from(el.attributes)) el.removeAttribute(a.name);
      if(el.tagName==='IMG'&&imageSource){el.setAttribute('src',imageSource);el.setAttribute('alt',imageAlt.slice(0,500));el.setAttribute('loading','lazy');el.setAttribute('decoding','async');el.setAttribute('referrerpolicy','no-referrer');}
      if(el.tagName==='A' && href && /^https?:\/\//i.test(href)) { el.setAttribute('href',href);el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer'); }
      if(color && /^(#[a-f0-9]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]+)$/i.test(color)) (el as HTMLElement).style.color=color;
      if(bg && /^(#[a-f0-9]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]+)$/i.test(bg)) (el as HTMLElement).style.backgroundColor=bg;
    }
  } walk(doc.body); return doc.body.innerHTML;
}
export function plainText(html:string) { if(typeof document==='undefined') return ''; const d=new DOMParser().parseFromString(safeHtml(html),'text/html');return d.body.textContent || ''; }
