import type { Article } from './model';
import { safeHtml } from './sanitize';
import { PDF_PALETTES, pdfGroups, type PdfCollections, type PdfSettings } from './pdf-export-model';

const escape=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
function safeLink(value:string){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}}
function content(entry:Article,isExample:boolean,images:boolean){
 const doc=new DOMParser().parseFromString(safeHtml(entry.contentHtml),'text/html');
 let source=entry.sourceName;
 if(isExample){
  doc.querySelectorAll('h2,h3,h4').forEach(node=>{if(/^(example|key facts|use in an answer|where could i use this\??)$/i.test(node.textContent?.trim()||''))node.remove();});
  doc.querySelectorAll('p,div').forEach(node=>{const text=node.textContent?.trim()||'';if(/^source\s*:/i.test(text)&&!node.querySelector('p,div,table,img')){source ||= text.replace(/^source\s*:\s*/i,'');node.remove();}});
 }
 if(!images){doc.querySelectorAll('figure,img,figcaption').forEach(node=>node.remove());}
 // Use the selected print palette on white paper, including in dark-mode exports.
 doc.querySelectorAll('*').forEach(node=>node.removeAttribute('style'));
 doc.querySelectorAll('img').forEach(node=>{node.setAttribute('loading','eager');node.setAttribute('decoding','sync');});
 // Repeat the first header row on continued tables, including older imported tables.
 doc.querySelectorAll('table').forEach(table=>{
  if(table.querySelector('thead'))return;
  const row=table.querySelector('tr');
  if(row?.children.length&&Array.from(row.children).every(cell=>cell.tagName==='TH')){const head=doc.createElement('thead');head.appendChild(row);table.insertBefore(head,table.firstChild);}
 });
 const html=doc.body.innerHTML;
 const hasContent=doc.body.textContent?.trim()||doc.querySelector('img,table');
 return {html:hasContent?html:'<p>'+escape(entry.summary||'')+'</p>',source};
}
function sourceLine(name:string,url:string){
 const link=safeLink(url);
 if(!name&&!link)return '';
 return '<p class="source">Source: '+(link?'<a href="'+escape(link)+'">'+escape(name||link)+'</a>':escape(name))+'</p>';
}
function entryHtml(entry:Article,isExample:boolean,settings:PdfSettings){
 const body=content(entry,isExample,settings.includeImages);
 const date=!isExample?'<p class="entry-date">'+escape(new Date(entry.newsDate+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}))+'</p>':'';
 const question=isExample&&settings.includeRecallQuestions&&entry.recallQuestion?.trim()?'<p class="recall-question"><strong>Recall:</strong> '+escape(entry.recallQuestion.trim())+'</p>':'';
 const summary=!isExample&&entry.summary?'<p class="entry-summary">'+escape(entry.summary)+'</p>':'';
 return '<article class="entry '+(isExample?'entry-example':'entry-news')+'"><h3 class="entry-title">'+escape(entry.title)+'</h3>'+date+question+summary+'<div class="prose">'+body.html+'</div>'+sourceLine(body.source,entry.sourceUrl)+'</article>';
}
export function buildPdfDocument(data:PdfCollections,settings:PdfSettings,origin:string,now=new Date()):string{
 if(typeof document==='undefined')throw new Error('Open PDF export in your browser.');
 const allowedOrigin=new URL(origin);if(!['http:','https:'].includes(allowedOrigin.protocol))throw new Error('Invalid preview origin.');
 const palette=PDF_PALETTES[settings.palette]||PDF_PALETTES.warm;
 const orientation=settings.orientation==='landscape'?'landscape':'portrait',paper=settings.paper==='Letter'?'Letter':'A4',columns=settings.columns===2?2:1;
 const font=[10,11,12].includes(settings.fontSize)?settings.fontSize:11;
 const pageWidth=paper==='A4'?(orientation==='landscape'?297:210):(orientation==='landscape'?279.4:215.9);
 const title=settings.collection==='both'?'Current Affairs & Examples':settings.collection==='examples'?'Examples':'Current Affairs';
 let count=0;
 const sections=(['articles','examples'] as const).filter(collection=>settings.collection==='both'||settings.collection===collection).map(collection=>{
  const groups=pdfGroups(data[collection],settings);const size=groups.reduce((sum,group)=>sum+group.entries.length,0);count+=size;
  if(!size)return '';
  return '<section class="collection"><h1 class="collection-title">'+(collection==='examples'?'Examples':'Current Affairs')+' <span>'+size+' '+(collection==='examples'?'examples':'notes')+'</span></h1><div class="pdf-flow">'+groups.map(group=>(group.subject?'<h2 class="subject-heading">'+escape(group.subject)+'</h2>':'')+group.entries.map(entry=>entryHtml(entry,collection==='examples',settings)).join('')).join('')+'</div></section>';
 }).join('');
 if(!count)throw new Error('No entries match your export settings.');
 const stamp=now.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'});
 const fileTitle='UPSC '+title+' '+now.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>'+escape(fileTitle)+'</title><style>'+`
 @page{size:${paper} ${orientation};margin:14mm 13mm 16mm}
 :root{color-scheme:light;--accent:${palette.accent};--ink:${palette.text};--soft:${palette.soft};--line:${palette.line}}
 *{box-sizing:border-box}body{margin:0;background:#e8e8e8;color:var(--ink);font-family:Arial,"Noto Sans",sans-serif;font-size:${font}pt;line-height:1.55}
 .preview-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 24px;background:#fff;border-bottom:1px solid #ccc;font-size:14px;box-shadow:0 2px 8px #0001}.preview-toolbar p{margin:4px 0;color:#555;max-width:800px}.preview-toolbar button{border:1px solid #aaa;border-radius:6px;padding:10px 14px;cursor:pointer;background:#fff;font-size:14px;white-space:nowrap}.preview-toolbar .print-button{background:var(--accent);color:#fff;border-color:var(--accent)}.preview-toolbar button:disabled{opacity:.5;cursor:wait}.preview-actions{display:flex;gap:8px}.image-status{font-weight:bold;color:#74491c!important}
 .paper{width:${pageWidth}mm;max-width:calc(100% - 32px);margin:24px auto;padding:14mm 13mm;background:#fff;box-shadow:0 2px 18px #0002}.document-header{border-bottom:2px solid var(--accent);padding-bottom:6mm;margin-bottom:7mm}.document-header h1{font-family:Georgia,serif;font-size:24pt;line-height:1.2;margin:0 0 3mm;font-weight:700;color:var(--accent)}.document-header p{font-size:9pt;color:#555;margin:0}
 .collection{margin-bottom:7mm}.collection-title{font-size:16pt;color:var(--accent);border-bottom:1px solid var(--line);padding-bottom:2mm;margin:0 0 5mm;font-weight:700;break-after:avoid}.collection-title span{font-size:9pt;font-weight:400;color:#555;margin-left:3mm}.pdf-flow{column-count:${columns};column-gap:8mm;column-rule:1px solid var(--line)}
 .subject-heading{font-family:Georgia,serif;font-size:14pt;line-height:1.3;font-weight:700;background:var(--soft);color:var(--accent);border-left:3px solid var(--accent);padding:2mm 3mm;margin:0 0 4mm;break-after:avoid;page-break-after:avoid}
 .entry{margin:0 0 5mm;padding:0 0 4mm;border-bottom:1px solid var(--line);overflow-wrap:anywhere}.entry-example{break-inside:avoid;page-break-inside:avoid}.entry-title{font-family:Georgia,serif;font-size:13pt;line-height:1.35;font-weight:700;margin:0 0 2mm;color:var(--ink);break-after:avoid;page-break-after:avoid}.entry-date{font-size:9pt;color:#555;margin:0 0 2mm}.entry-summary{font-style:italic;margin:0 0 3mm}.recall-question{font-size:10pt;background:var(--soft);padding:2mm 3mm;margin:0 0 3mm}
 .prose p{margin:0 0 2.5mm}.prose h2,.prose h3,.prose h4{color:var(--accent);font-size:11.5pt;line-height:1.35;font-weight:700;margin:4mm 0 2mm;break-after:avoid;page-break-after:avoid}.prose> :first-child{margin-top:0}.prose ul,.prose ol{padding-left:5mm;margin:2mm 0 3mm}.prose li{margin-bottom:1.5mm}.prose blockquote{border-left:2px solid var(--line);padding-left:3mm;margin:3mm 0;color:#444}p,li{orphans:3;widows:3}b,strong{font-weight:700}u{text-underline-offset:2px}mark{background:#fff0ad;color:#222}a{color:var(--accent);text-decoration:underline}
 table{width:100%;border-collapse:collapse;table-layout:fixed;margin:3mm 0;font-size:9pt;line-height:1.4;break-inside:auto}th,td{border:1px solid var(--line);padding:2mm;vertical-align:top;overflow-wrap:anywhere}th{background:var(--soft);color:var(--ink);font-weight:700;text-align:left}thead{display:table-header-group}tfoot{display:table-footer-group}tr{break-inside:avoid;page-break-inside:avoid}
 figure{margin:3mm 0;break-inside:avoid;page-break-inside:avoid}img[hidden]{display:none}img{display:block;width:auto;height:auto;max-width:100%;max-height:${columns===2?85:125}mm;object-fit:contain;margin:3mm auto;break-inside:avoid}figcaption{font-size:9pt;line-height:1.4;color:#555;margin-top:1mm}.missing-image{display:block;padding:3mm;border:1px dashed #999;font-size:9pt;color:#555}.source{font-size:9pt;line-height:1.5;color:#555;margin:2mm 0 0;overflow-wrap:anywhere}
 @media print{html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.preview-toolbar{display:none!important}.paper{width:auto;max-width:none;margin:0;padding:0;box-shadow:none}.pdf-flow{column-fill:auto}.collection:last-child{margin-bottom:0}}
 @media screen and (max-width:700px){.preview-toolbar{align-items:flex-start;flex-direction:column;padding:12px}.paper{max-width:none;margin:16px;width:${pageWidth}mm}}
 `+'</style><script src="'+escape(allowedOrigin.origin)+'/pdf-print.js" defer></script></head><body><aside class="preview-toolbar"><div><strong>PDF export preview</strong><p>'+escape(paper+' · '+orientation+' · '+columns+' column'+(columns===2?'s':''))+' · Choose “Save as PDF” in the print dialog. Turn off browser headers and footers.</p><p id="image-status" role="status" aria-live="polite">Preparing images…</p></div><div class="preview-actions"><button type="button" id="retry-images" hidden>Retry images</button><button type="button" id="save-pdf" class="print-button" disabled>Save as PDF / Print</button></div></aside><main class="paper"><header class="document-header"><h1>'+escape(title)+'</h1><p>UPSC revision notes · Exported '+escape(stamp)+' · '+count+' entries</p></header>'+sections+'</main></body></html>';
}
