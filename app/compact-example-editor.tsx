'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, X, Trash2, Bold, Italic, Underline } from 'lucide-react';
import type { Article } from './model';
import { SUBJECTS } from './model';
import { exampleSchema, EXAMPLE_PAPERS } from './example-model';
import { exampleBody, exampleFormatting } from './example-text';
import { useModal } from './use-modal';

type Props={entry:Article;onSave:(entry:Article)=>Promise<void>;onClose:()=>void;onRemove:()=>void};
function Discard({onKeep,onDiscard}:{onKeep:()=>void;onDiscard:()=>void}){
 const ref=useModal(onKeep);
 return <div className="overlay nested"><section ref={ref} role="alertdialog" aria-modal="true" className="confirm-dialog" aria-labelledby="discard-example-title"><h2 id="discard-example-title">Discard your changes?</h2><p>Your unsaved changes will be lost.</p><div className="modal-actions"><button className="button secondary" onClick={onKeep}>Keep editing</button><button className="button danger" onClick={onDiscard}>Discard changes</button></div></section></div>;
}
export default function CompactExampleEditor({entry,onSave,onClose,onRemove}:Props){
 const initial=useRef(exampleBody(entry));
 const [source,setSource]=useState(initial.current.source),[sourceUrl,setSourceUrl]=useState(entry.sourceUrl),[title,setTitle]=useState(entry.title);
 const [subjects,setSubjects]=useState(entry.subjects),[papers,setPapers]=useState(entry.gsPaper),[tags,setTags]=useState(entry.tags.join(', '));
 const [dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[discard,setDiscard]=useState(false),[error,setError]=useState('');
 const textRef=useRef<HTMLDivElement>(null),selectionRef=useRef<Range|null>(null);
 const [format,setFormat]=useState({bold:false,italic:false,underline:false});
 const close=()=>{if(!saving)(dirty?setDiscard(true):onClose());};
 const ref=useModal(close);
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';if(textRef.current){textRef.current.innerHTML=entry.updatedAt?initial.current.html:'';textRef.current.focus();}return()=>{document.body.style.overflow=previous;};},[]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 function touch(){setDirty(true);setError('');}
 function rememberSelection(){
  const root=textRef.current,selection=window.getSelection();
  if(root&&selection?.rangeCount&&root.contains(selection.getRangeAt(0).commonAncestorContainer)){
   selectionRef.current=selection.getRangeAt(0).cloneRange();
   setFormat({bold:document.queryCommandState('bold'),italic:document.queryCommandState('italic'),underline:document.queryCommandState('underline')});
  }
 }
 useEffect(()=>{document.addEventListener('selectionchange',rememberSelection);return()=>document.removeEventListener('selectionchange',rememberSelection);},[]);
 function applyFormat(command:'bold'|'italic'|'underline'){
  const root=textRef.current;if(!root||saving)return;
  root.focus();const selection=window.getSelection(),range=selectionRef.current;
  if(range&&root.contains(range.commonAncestorContainer)){selection?.removeAllRanges();selection?.addRange(range);}
  document.execCommand(command,false);rememberSelection();touch();
 }
 async function save(event:React.FormEvent){
  event.preventDefault();if(saving)return;setError('');setSaving(true);
  try{
   const body=exampleFormatting(textRef.current?.innerHTML||'');
   const text=body.text;
   if(!text.trim())throw new Error('Add your example before saving.');
   if(text.length>Math.max(600,initial.current.text.length))throw new Error('Keep your example within '+Math.max(600,initial.current.text.length)+' characters.');
   const parsed=exampleSchema.safeParse({...entry,title:title.trim()||text.trim().split(/\n|[.!?]\s/)[0].slice(0,120),summary:'',contentHtml:'<p>'+body.html+'</p>',sourceName:source.trim(),sourceUrl:sourceUrl.trim(),subjects,gsPaper:papers,tags:[...new Set(tags.split(',').map(tag=>tag.trim()).filter(Boolean))]});
   if(!parsed.success)throw new Error(parsed.error.issues.map(issue=>issue.message).join(' '));
   await onSave({...parsed.data,createdAt:entry.createdAt,updatedAt:entry.updatedAt});
  }catch(error){setError((error as Error).message);}finally{setSaving(false);}
 }
 return <div className="overlay editor-overlay"><section ref={ref} className="compact-example-editor" role="dialog" aria-modal="true" aria-labelledby="compact-example-title"><header className="modal-header"><h2 id="compact-example-title">{entry.updatedAt?'Edit example':'Add an example'}</h2><button className="icon-btn" aria-label="Close example editor" onClick={close} disabled={saving}><X size={20}/></button></header><form onSubmit={save}><div className="compact-example-fields"><div className="field"><label id="example-format-label">Example <small>Keep it to 2–3 short lines.</small></label><div className="example-format-editor"><div className="example-format-toolbar" role="group" aria-label="Example text formatting">{([{command:'bold',label:'Bold',Icon:Bold,key:'B'},{command:'italic',label:'Italic',Icon:Italic,key:'I'},{command:'underline',label:'Underline',Icon:Underline,key:'U'}] as const).map(({command,label,Icon,key})=><button key={command} type="button" className="icon-btn" aria-label={label} aria-pressed={format[command]} title={label+' (Ctrl/⌘ '+key+')'} disabled={saving} onMouseDown={event=>event.preventDefault()} onClick={()=>applyFormat(command)}><Icon size={16}/></button>)}</div><div ref={textRef} className="example-format-input" contentEditable={!saving} suppressContentEditableWarning role="textbox" aria-labelledby="example-format-label" aria-multiline="true" aria-required="true" data-placeholder="Write the example in a few clear sentences…" onInput={()=>{touch();rememberSelection();}} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&!event.altKey){const command=({b:'bold',i:'italic',u:'underline'} as const)[event.key.toLowerCase() as 'b'|'i'|'u'];if(command){event.preventDefault();applyFormat(command);}}}} onPaste={event=>{event.preventDefault();const html=event.clipboardData.getData('text/html');const plain=event.clipboardData.getData('text/plain');const safe=html?exampleFormatting(html).html:plain.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r?\n/g,'<br>');document.execCommand('insertHTML',false,safe);touch();rememberSelection();}}/></div></div><label className="field">Source <small>For example: WHO, UNICEF, 2024</small><input maxLength={150} placeholder="Organisation, report or publication, year" value={source} onChange={event=>{setSource(event.target.value);touch();}}/></label><fieldset className="compact-paper-options"><legend>GS paper <small>Choose one or more</small></legend>{EXAMPLE_PAPERS.map(paper=><label key={paper}><input type="checkbox" checked={papers.includes(paper)} onChange={event=>{setPapers(event.target.checked?[...papers,paper]:papers.filter(value=>value!==paper));touch();}}/>{paper}</label>)}</fieldset><label className="field">Topic tags <small>Separate with commas</small><input value={tags} placeholder="Water & sanitation, Poverty, Health" onChange={event=>{setTags(event.target.value);touch();}}/></label><details className="example-extra-fields"><summary>Subjects and optional details</summary><fieldset className="compact-subject-options"><legend>Subjects</legend>{SUBJECTS.map(subject=><label key={subject}><input type="checkbox" checked={subjects.includes(subject)} onChange={event=>{setSubjects(event.target.checked?[...subjects,subject]:subjects.filter(value=>value!==subject));touch();}}/>{subject}</label>)}</fieldset><label className="field">Heading <small>Optional · for example: Reaching the Last Mile Fund</small><input value={title} maxLength={300} onChange={event=>{setTitle(event.target.value);touch();}}/></label><label className="field">Source link <small>Optional</small><input type="url" value={sourceUrl} placeholder="https://…" onChange={event=>{setSourceUrl(event.target.value);touch();}}/></label></details>{error&&<p className="form-error" role="alert">{error}</p>}</div><footer className="editor-footer"><div>{entry.updatedAt&&<button className="text-btn example-remove" type="button" disabled={saving} onClick={onRemove}><Trash2 size={14}/> Delete example</button>}</div><div><button className="button secondary" type="button" disabled={saving} onClick={close}>Cancel</button><button className="button primary" type="submit" disabled={saving}><Check size={15}/>{saving?'Saving…':'Save example'}</button></div></footer></form></section>{discard&&<Discard onKeep={()=>setDiscard(false)} onDiscard={onClose}/>}</div>;
}
