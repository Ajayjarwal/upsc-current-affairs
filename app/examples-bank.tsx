'use client';
import { useEffect, useRef, useState } from 'react';
import { Bookmark, Pencil, Plus, Brain, ArrowLeft, RotateCcw, Check, Eye, ChevronDown } from 'lucide-react';
import type { Article } from './model';
import { exampleBody, type ExampleImage } from './example-text';
import { currentRecall, isDue, parseRecallProgress, prioritiseExamples, reviewExample, type RecallGrade, type RecallProgress } from './example-recall';

type Props={entries:Article[];loading:boolean;busy:boolean;hasEntries:boolean;storageKey:string;onEdit:(entry:Article)=>void;onBookmark:(entry:Article)=>void;onNew:()=>void;onImport:()=>void;onReset:()=>void};
type Session={entries:Article[];index:number;results:{id:string;grade:RecallGrade}[]};
const gradeLabel={forgot:'Forgot',partly:'Partly remembered',remembered:'Remembered'};
function reviewLabel(dueAt:number,now:number){
 if(dueAt<=now)return 'Ready to review';
 if(dueAt-now<60*60*1000)return 'Review in '+Math.max(1,Math.ceil((dueAt-now)/60000))+' min';
 const date=new Date(dueAt),today=new Date(now),tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);
 if(date.toDateString()===today.toDateString())return 'Review today';
 if(date.toDateString()===tomorrow.toDateString())return 'Review tomorrow';
 return 'Next review: '+date.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}
function Source({entry}:{entry:Article}){
 const source=exampleBody(entry).source;
 if(!source&&!entry.sourceUrl)return null;
 return <p className="example-source">Source: {entry.sourceUrl?<a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">{source||new URL(entry.sourceUrl).hostname}</a>:source}</p>;
}
function ExampleImages({images}:{images:ExampleImage[]}){
 if(!images.length)return null;
 return <div className="example-images">{images.map((image,index)=><figure key={index}><img src={image.src} alt={image.description} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>{image.description&&<figcaption>{image.description}</figcaption>}</figure>)}</div>;
}
function ExampleTags({entry}:{entry:Article}){
 return <div className="example-chips example-expanded-tags" aria-label="Subjects, GS papers and topic tags">{entry.subjects.map(subject=><span key={'subject-'+subject}>{subject}</span>)}{entry.gsPaper.map(paper=><span key={'paper-'+paper}>{paper}</span>)}{entry.tags.map(tag=><span key={'tag-'+tag}>#{tag}</span>)}</div>;
}
function ExampleRow({entry,record,now,busy,canPractise,onBookmark,onEdit,onPractise}:{entry:Article;record:ReturnType<typeof currentRecall>;now:number;busy:boolean;canPractise:boolean;onBookmark:()=>void;onEdit:()=>void;onPractise:()=>void}){
 const [expanded,setExpanded]=useState(false);
 const headingRef=useRef<HTMLButtonElement>(null);
 const body=exampleBody(entry);
 const heading=entry.title.split(/\s*[:：]\s*/)[0].trim()||entry.title;
 const panelId='example-expanded-'+entry.id;
 return <article className={'example-row '+(expanded?'is-expanded':'')} onKeyDown={event=>{if(event.key==='Escape'&&expanded){event.preventDefault();setExpanded(false);headingRef.current?.focus();}}}><h2 className="example-heading"><button ref={headingRef} className="example-heading-button" aria-expanded={expanded} aria-controls={panelId} onClick={()=>setExpanded(value=>!value)}><span>{heading}</span><ChevronDown size={18} aria-hidden="true"/></button></h2><div id={panelId} className="example-expansion" aria-hidden={!expanded} inert={!expanded}><div className="example-expansion-inner"><div className="example-expanded-content"><p className="example-sentence" dangerouslySetInnerHTML={{__html:body.html}}/><ExampleImages images={body.images}/><Source entry={entry}/><ExampleTags entry={entry}/><footer className="example-expanded-footer"><span className="example-review-date">{record?reviewLabel(record.dueAt,now):''}</span><div className="example-row-actions"><button className="icon-btn" onClick={onBookmark} disabled={busy} aria-label={entry.bookmarked?'Remove example bookmark':'Bookmark example'} title={entry.bookmarked?'Remove bookmark':'Bookmark'}><Bookmark size={16} fill={entry.bookmarked?'currentColor':'none'}/></button><button className="icon-btn" disabled={busy} onClick={onEdit} aria-label="Edit example" title="Edit example"><Pencil size={16}/></button><button className="button secondary" onClick={onPractise} disabled={!canPractise}><Brain size={16}/> Practise this example</button></div></footer></div></div></div></article>;
}

export default function ExamplesBank({entries,loading,busy,hasEntries,storageKey,onEdit,onBookmark,onNew,onImport,onReset}:Props){
 const [progress,setProgress]=useState<RecallProgress>({}),[loaded,setLoaded]=useState(false),[storageError,setStorageError]=useState('');
 const [session,setSession]=useState<Session|null>(null),[revealed,setRevealed]=useState(false),[clock,setClock]=useState(Date.now);
 const practiceRef=useRef<HTMLButtonElement>(null),questionRef=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{try{setProgress(parseRecallProgress(localStorage.getItem(storageKey)));}catch{setStorageError('Practice progress cannot be saved in this browser. You can still practise.');}setLoaded(true);},[storageKey]);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const due=entries.filter(entry=>isDue(entry,progress,clock));
 function begin(pool=due.length?due:entries){if(!pool.length||!loaded)return;setSession({entries:prioritiseExamples(pool,progress),index:0,results:[]});setRevealed(false);}
 useEffect(()=>{if(session)questionRef.current?.focus();},[session?.index,!!session]);
 function leave(){setSession(null);setRevealed(false);requestAnimationFrame(()=>practiceRef.current?.focus());}
 useEffect(()=>{if(!session)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('[role="dialog"],[role="alertdialog"]')){event.preventDefault();leave();}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[!!session]);
 function rate(grade:RecallGrade){
  if(!session||!revealed)return;
  const entry=session.entries[session.index];if(!entry)return;
  const next={...progress,[entry.id]:reviewExample(entry,currentRecall(entry,progress),grade)};
  setProgress(next);try{localStorage.setItem(storageKey,JSON.stringify(next));setStorageError('');}catch{setStorageError('Your practice progress could not be saved in this browser. You can still practise.');}
  setSession({...session,index:session.index+1,results:[...session.results,{id:entry.id,grade}]});setRevealed(false);setClock(Date.now());
 }
 if(loading&&!hasEntries)return <div className="examples-loading"><span className="spinner"/>Loading your examples…</div>;
 if(!entries.length)return <section className="examples-empty"><Brain size={30}/><h2>{hasEntries?'No matching examples':'Your examples, at a glance'}</h2><p>{hasEntries?'Try another subject or topic tag.':'Keep each example to 2–3 short lines, with its source below. Add one or import your examples to get started.'}</p><button className="button primary" onClick={hasEntries?onReset:onNew}>{hasEntries?'Clear filters':'Add an example'}</button>{!hasEntries&&<button className="text-btn" onClick={onImport}>Import examples</button>}</section>;
 if(session){
  const entry=session.entries[session.index];
  if(!entry){
   const missed=session.entries.filter(entry=>session.results.some(result=>result.id===entry.id&&result.grade!=='remembered'));
   return <section className="example-practice practice-complete" aria-label="Recall results"><Check size={30}/><h2 ref={questionRef} tabIndex={-1}>Round complete</h2><p>You reviewed {session.entries.length} {session.entries.length===1?'example':'examples'}.</p><div className="practice-results">{(['remembered','partly','forgot'] as RecallGrade[]).map(grade=><div key={grade}><strong>{session.results.filter(result=>result.grade===grade).length}</strong><span>{gradeLabel[grade]}</span></div>)}</div><p className="practice-hint">Examples you found harder will come up sooner in future reviews.</p><div className="practice-buttons">{!!missed.length&&<button className="button secondary" onClick={()=>begin(missed)}><RotateCcw size={15}/> Practise missed examples</button>}<button className="button primary" onClick={leave}>Back to examples</button></div>{storageError&&<p className="form-error" role="alert">{storageError}</p>}</section>;
  }
  const body=exampleBody(entry);
  const cue=entry.tags.length?entry.tags.slice(0,2).join(' · '):entry.subjects.join(' · ');
  return <section className="example-practice" aria-label="Practise recall"><header><button className="text-btn" onClick={leave}><ArrowLeft size={15}/> Back to examples</button><span aria-live="polite">Example {session.index+1} of {session.entries.length}</span></header><progress aria-label="Examples reviewed" max={session.entries.length} value={session.index}/><div className="practice-prompt"><span className="practice-label">RECALL AN EXAMPLE ABOUT</span><h2 ref={questionRef} tabIndex={-1}>{cue}</h2><p>Recall the key facts{body.source?' and source':''}, then reveal the example.</p></div>{revealed?<div className="practice-answer"><p className="example-sentence" dangerouslySetInnerHTML={{__html:body.html}}/><ExampleImages images={body.images}/><Source entry={entry}/><ExampleTags entry={entry}/></div>:<div className="practice-hidden"><Brain size={28}/><span>Take a moment to recall it.</span></div>}{!revealed?<button className="button primary reveal-example" onClick={()=>setRevealed(true)}><Eye size={16}/> Reveal example</button>:<div className="practice-rating"><p>How well did you remember it?</p><div className="practice-buttons"><button className="button secondary" onClick={()=>rate('forgot')}>Forgot</button><button className="button secondary" onClick={()=>rate('partly')}>Partly remembered</button><button className="button primary" onClick={()=>rate('remembered')}>Remembered</button></div></div>}<p className="practice-hint">Progress is saved in this browser.</p>{storageError&&<p className="form-error" role="alert">{storageError}</p>}</section>;
 }
 return <section className="examples-bank" aria-label="Expandable examples"><div className="examples-bank-tools"><span>{loaded?(due.length?due.length+' ready to review':'You’re up to date'):'Loading practice progress…'}</span><div><button className="button secondary" onClick={onNew}><Plus size={15}/> Add example</button><button ref={practiceRef} className="button primary" disabled={!loaded} onClick={()=>begin()}><Brain size={16}/> Practise recall</button></div></div><div className="example-rows">{entries.map(entry=><ExampleRow key={entry.id} entry={entry} record={currentRecall(entry,progress)} now={clock} busy={busy} canPractise={loaded} onBookmark={()=>onBookmark(entry)} onEdit={()=>onEdit(entry)} onPractise={()=>begin([entry])}/>)}</div>{storageError&&<p className="form-error" role="alert">{storageError}</p>}</section>;
}
