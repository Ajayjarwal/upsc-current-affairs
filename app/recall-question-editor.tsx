'use client';
import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Article } from './model';
import { recallCue } from './example-recall';
import { useModal } from './use-modal';

export default function RecallQuestionEditor({entry,onSave,onClose}:{entry:Article;onSave:(entry:Article)=>Promise<void>;onClose:()=>void}){
 const [question,setQuestion]=useState(entry.recallQuestion||''),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const close=()=>{if(!saving)onClose();};
 const ref=useModal(close);
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[]);
 const fallback=recallCue({...entry,recallQuestion:''});
 return <div className="overlay"><section ref={ref} role="dialog" aria-modal="true" aria-labelledby="recall-question-title" className="recall-question-editor"><header className="modal-header"><h2 id="recall-question-title">Edit recall question</h2><button className="icon-btn" aria-label="Close recall question editor" disabled={saving} onClick={close}><X size={20}/></button></header><form onSubmit={async event=>{event.preventDefault();if(saving)return;setSaving(true);setError('');try{await onSave({...entry,recallQuestion:question.trim()});onClose();}catch(error){setError((error as Error).message);}finally{setSaving(false);}}}><div className="recall-question-fields"><label className="field">Recall question<textarea autoFocus rows={3} maxLength={500} disabled={saving} value={question} placeholder="What was the global water and sanitation gap in 2024?" onChange={event=>{setQuestion(event.target.value);setError('');}}/></label><p>Leave blank to use the automatic topic cue: {fallback}.</p>{error&&<p className="form-error" role="alert">{error}</p>}</div><footer className="editor-footer"><div><button className="button secondary" type="button" disabled={saving} onClick={close}>Cancel</button><button className="button primary" type="submit" disabled={saving}><Check size={15}/>{saving?'Saving…':'Save question'}</button></div></footer></form></section></div>;
}
