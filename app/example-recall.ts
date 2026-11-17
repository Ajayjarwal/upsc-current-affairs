import type { Article } from './model';
export type RecallGrade = 'forgot' | 'partly' | 'remembered';
export type RecallRecord = {fingerprint:string;grade:RecallGrade;streak:number;reviewedAt:number;dueAt:number};
export type RecallProgress = Record<string,RecallRecord>;
const DAY=24*60*60*1000;
const INTERVALS=[1,3,7,14,30];
export function exampleFingerprint(entry:Pick<Article,'contentHtml'|'sourceName'|'sourceUrl'>):string {
 let hash=2166136261;
 for(const character of JSON.stringify([entry.contentHtml,entry.sourceName,entry.sourceUrl])){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
 return (hash>>>0).toString(16);
}
export function currentRecall(entry:Article,progress:RecallProgress):RecallRecord|undefined {
 const record=progress[entry.id];
 return record?.fingerprint===exampleFingerprint(entry)?record:undefined;
}
export function reviewExample(entry:Article,previous:RecallRecord|undefined,grade:RecallGrade,now=Date.now()):RecallRecord {
 const valid=previous?.fingerprint===exampleFingerprint(entry)?previous:undefined;
 const streak=grade==='remembered'?(valid?.streak??0)+1:0;
 const delay=grade==='forgot'?10*60*1000:grade==='partly'?DAY:INTERVALS[Math.min(streak-1,INTERVALS.length-1)]*DAY;
 return {fingerprint:exampleFingerprint(entry),grade,streak,reviewedAt:now,dueAt:now+delay};
}
export function isDue(entry:Article,progress:RecallProgress,now=Date.now()):boolean {
 const record=currentRecall(entry,progress);return !record||record.dueAt<=now;
}
export function prioritiseExamples(entries:Article[],progress:RecallProgress,now=Date.now()):Article[] {
 const rank=(entry:Article)=>{const record=currentRecall(entry,progress);return !record?1:record.dueAt>now?3:record.grade==='forgot'?0:1;};
 return [...entries].sort((a,b)=>rank(a)-rank(b)||(currentRecall(a,progress)?.dueAt??0)-(currentRecall(b,progress)?.dueAt??0));
}
export function parseRecallProgress(value:string|null):RecallProgress {
 try{
  const parsed=JSON.parse(value??'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
  return Object.fromEntries(Object.entries(parsed).filter(([id,raw])=>{
   if(!id||!raw||typeof raw!=='object')return false;
   const r=raw as RecallRecord;return typeof r.fingerprint==='string'&&['forgot','partly','remembered'].includes(r.grade)&&Number.isInteger(r.streak)&&r.streak>=0&&Number.isFinite(r.reviewedAt)&&Number.isFinite(r.dueAt);
  })) as RecallProgress;
 }catch{return {};}
}
