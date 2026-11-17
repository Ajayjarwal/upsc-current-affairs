'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, X, Trash2, Bold, Italic, Underline, Upload, ImagePlus } from 'lucide-react';
import type { Article } from './model';
import { SUBJECTS } from './model';
import { exampleSchema, EXAMPLE_PAPERS } from './example-model';
import { exampleBody, exampleFormatting } from './example-text';
import { imageMarkup, prepareArticleImage, safeImageSource } from './images';
import { useModal } from './use-modal';

type Props={entry:Article;onSave:(entry:Article)=>Promise<void>;onClose:()=>void;onRemove:()=>void};
function Discard({onKeep,onDiscard}:{onKeep:()=>void;onDiscard:()=>void}){
 const ref=useModal(onKeep);
 return <div className="overlay nested"><section ref={ref} role="alertdialog" aria-modal="true" className="confirm-dialog" aria-labelledby="discard-example-title"><h2 id="discard-example-title">Discard your changes?</h2><p>Your unsaved changes will be lost.</p><div className="modal-actions"><button className="button secondary" onClick={onKeep}>Keep editing</button><button className="button danger" onClick={onDiscard}>Discard changes</button></div></section></div>;
}
export default function CompactExampleEditor({entry,onSave,onClose,onRemove}:Props){
 const [initial]=useState(()=>exampleBody(entry));
 const [source,setSource]=useState(initial.source),[sourceUrl,setSourceUrl]=useState(entry.sourceUrl),[title,setTitle]=useState(entry.title);
 const [subjects,setSubjects]=useState(entry.subjects),[papers,setPapers]=useState(entry.gsPaper),[tags,setTags]=useState(entry.tags.join(', '));
 const [images,setImages]=useState(initial.images),[imageUrl,setImageUrl]=useState(''),[imageDescription,setImageDescription]=useState(''),[imageBusy,setImageBusy]=useState(false);
 const imageInput=useRef<HTMLInputElement>(null);
 const [dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[discard,setDiscard]=useState(false),[error,setError]=useState('');
 const textRef=useRef<HTMLDivElement>(null),selectionRef=useRef<Range|null>(null);
 const [format,setFormat]=useState({bold:false,italic:false,underline:false});
 const close=()=>{if(!saving&&!imageBusy)(dirty?setDiscard(true):onClose());};
 const ref=useModal(close);
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';if(textRef.current){textRef.current.innerHTML=entry.updatedAt?initial.html:'';textRef.current.focus();}return()=>{document.body.style.overflow=previous;};},[]);
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
 function addImage(src:string,description=imageDescription){
  const safe=safeImageSource(src);if(!safe)throw new Error('Use an http/https image URL or upload a PNG, JPG or WebP image.');
  if(images.reduce((length,image)=>length+imageMarkup(image.src,image.description).length,0)+imageMarkup(safe,description).length>1_400_000)throw new Error('Too many images. Remove an image or use an image URL.');
  setImages(current=>[...current,{src:safe,description:description.trim().slice(0,500)}]);setImageUrl('');setImageDescription('');touch();
 }
 async function uploadImage(file:File){
  if(saving||imageBusy)return;setImageBusy(true);setError('');
  try{addImage(await prepareArticleImage(file),imageDescription||file.name.replace(/\.[^.]+$/,''));}catch(error){setError((error as Error).message);}finally{setImageBusy(false);if(imageInput.current)imageInput.current.value='';}
 }
 async function save(event:React.FormEvent){
  event.preventDefault();if(saving||imageBusy)return;setError('');setSaving(true);
  try{
   const body=exampleFormatting(textRef.current?.innerHTML||'');
   const text=body.text;
   if(!text.trim())throw new Error('Add your example before saving.');
   if(text.length>Math.max(600,initial.text.length))throw new Error('Keep your example within '+Math.max(600,initial.text.length)+' characters.');
   const parsed=exampleSchema.safeParse({...entry,title:title.trim()||text.trim().split(/\n|[.!?]\s/)[0].slice(0,120),summary:'',contentHtml:'<p>'+body.html+'</p>'+images.map(image=>imageMarkup(image.src,image.description)).join(''),sourceName:source.trim(),sourceUrl:sourceUrl.trim(),subjects,gsPaper:papers,tags:[...new Set(tags.split(',').map(tag=>tag.trim()).filter(Boolean))]});
   if(!parsed.success)throw new Error(parsed.error.issues.map(issue=>issue.message).join(' '));
   await onSave({...parsed.data,createdAt:entry.createdAt,updatedAt:entry.updatedAt});
  }catch(error){setError((error as Error).message);}finally{setSaving(false);}
 }
 return <div className="overlay editor-overlay"><section ref={ref} className="compact-example-editor" role="dialog" aria-modal="true" aria-labelledby="compact-example-title"><header className="modal-header"><h2 id="compact-example-title">{entry.updatedAt?'Edit example':'Add an example'}</h2><button className="icon-btn" aria-label="Close example editor" onClick={close} disabled={saving||imageBusy}><X size={20}/></button></header><form onSubmit={save}><div className="compact-example-fields"><label className="field">Heading <small>Optional · for example: Reaching the Last Mile Fund</small><input value={title} maxLength={300} onChange={event=>{setTitle(event.target.value);touch();}}/></label><div className="field"><label id="example-format-label">Example <small>Keep it to 2–3 short lines.</small></label><div className="example-format-editor"><div className="example-format-toolbar" role="group" aria-label="Example text formatting">{([{command:'bold',label:'Bold',Icon:Bold,key:'B'},{command:'italic',label:'Italic',Icon:Italic,key:'I'},{command:'underline',label:'Underline',Icon:Underline,key:'U'}] as const).map(({command,label,Icon,key})=><button key={command} type="button" className="icon-btn" aria-label={label} aria-pressed={format[command]} title={label+' (Ctrl/⌘ '+key+')'} disabled={saving} onMouseDown={event=>event.preventDefault()} onClick={()=>applyFormat(command)}><Icon size={16}/></button>)}</div><div ref={textRef} className="example-format-input" contentEditable={!saving} suppressContentEditableWarning role="textbox" aria-labelledby="example-format-label" aria-multiline="true" aria-required="true" data-placeholder="Write the example in a few clear sentences…" onInput={()=>{touch();rememberSelection();}} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&!event.altKey){const command=({b:'bold',i:'italic',u:'underline'} as const)[event.key.toLowerCase() as 'b'|'i'|'u'];if(command){event.preventDefault();applyFormat(command);}}}} onPaste={event=>{event.preventDefault();const file=Array.from(event.clipboardData.files).find(file=>file.type.startsWith('image/'));if(file){void uploadImage(file);return;}const html=event.clipboardData.getData('text/html');const plain=event.clipboardData.getData('text/plain');const safe=html?exampleFormatting(html).html:plain.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r?\n/g,'<br>');document.execCommand('insertHTML',false,safe);touch();rememberSelection();}}/></div></div><label className="field">Source <small>For example: WHO, UNICEF, 2024</small><input maxLength={150} placeholder="Organisation, report or publication, year" value={source} onChange={event=>{setSource(event.target.value);touch();}}/></label><fieldset className="compact-paper-options"><legend>GS paper <small>Choose one or more</small></legend>{EXAMPLE_PAPERS.map(paper=><label key={paper}><input type="checkbox" checked={papers.includes(paper)} onChange={event=>{setPapers(event.target.checked?[...papers,paper]:papers.filter(value=>value!==paper));touch();}}/>{paper}</label>)}</fieldset><fieldset className="compact-subject-options"><legend>Subjects</legend>{SUBJECTS.map(subject=><label key={subject}><input type="checkbox" checked={subjects.includes(subject)} onChange={event=>{setSubjects(event.target.checked?[...subjects,subject]:subjects.filter(value=>value!==subject));touch();}}/>{subject}</label>)}</fieldset><label className="field">Topic tags <small>Separate with commas</small><input value={tags} placeholder="Water & sanitation, Poverty, Health" onChange={event=>{setTags(event.target.value);touch();}}/></label><label className="field">Source link <small>Optional</small><input type="url" value={sourceUrl} placeholder="https://…" onChange={event=>{setSourceUrl(event.target.value);touch();}}/></label><section className="example-image-tools" aria-labelledby="example-images-label"><h3 id="example-images-label">Images <small>Optional</small></h3><div className="example-image-list">{images.map((image,index)=><figure key={index}><img src={image.src} alt={image.description} loading="lazy" referrerPolicy="no-referrer"/><div><label className="field">Image description<input value={image.description} maxLength={500} disabled={saving||imageBusy} onChange={event=>{setImages(current=>current.map((item,i)=>i===index?{...item,description:event.target.value}:item));touch();}}/></label><button type="button" className="text-btn" disabled={saving||imageBusy} onClick={()=>{setImages(current=>current.filter((_,i)=>i!==index));touch();}} aria-label={'Remove image '+(index+1)}><Trash2 size={14}/> Remove image</button></div></figure>)}</div><label className="field">Description for new image <small>Optional</small><input value={imageDescription} maxLength={500} disabled={saving||imageBusy} placeholder="Describe the image" onChange={event=>{setImageDescription(event.target.value);touch();}}/></label><div className="example-image-add"><button type="button" className="button secondary" disabled={saving||imageBusy} onClick={()=>imageInput.current?.click()}><Upload size={15}/>{imageBusy?'Preparing image…':'Upload image'}</button><small>PNG, JPG or WebP · up to 10 MB · compressed automatically</small></div><input hidden ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload example image" disabled={saving||imageBusy} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadImage(file);}}/><div className="example-image-url"><label className="field">Or use an image URL<input type="url" value={imageUrl} disabled={saving||imageBusy} placeholder="https://example.com/image.jpg" onChange={event=>{setImageUrl(event.target.value);touch();}}/></label><button type="button" className="button secondary" disabled={saving||imageBusy||!imageUrl.trim()} onClick={()=>{try{addImage(imageUrl);}catch(error){setError((error as Error).message);}}}><ImagePlus size={15}/> Add image</button></div></section>{error&&<p className="form-error" role="alert">{error}</p>}</div><footer className="editor-footer"><div>{entry.updatedAt&&<button className="text-btn example-remove" type="button" disabled={saving||imageBusy} onClick={onRemove}><Trash2 size={14}/> Delete example</button>}</div><div><button className="button secondary" type="button" disabled={saving||imageBusy} onClick={close}>Cancel</button><button className="button primary" type="submit" disabled={saving||imageBusy}><Check size={15}/>{saving?'Saving…':'Save example'}</button></div></footer></form></section>{discard&&<Discard onKeep={()=>setDiscard(false)} onDiscard={onClose}/>}</div>;
}
