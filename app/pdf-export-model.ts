import type { Article } from './model';

export const PDF_PALETTES={
 warm:{name:'Warm',accent:'#8a4b28',text:'#292420',soft:'#f4ece3',line:'#d8c8b8'},
 navy:{name:'Navy',accent:'#234b78',text:'#172532',soft:'#edf2f8',line:'#c5d2e0'},
 forest:{name:'Forest',accent:'#286048',text:'#1e2923',soft:'#edf4ee',line:'#c7d8cc'},
 monochrome:{name:'Black & white',accent:'#111111',text:'#111111',soft:'#f1f1f1',line:'#bcbcbc'},
} as const;
export type PdfSettings={collection:'articles'|'examples'|'both';subjectMode:'all'|'include'|'exclude';subjects:string[];orientation:'portrait'|'landscape';columns:1|2;paper:'A4'|'Letter';palette:keyof typeof PDF_PALETTES;fontSize:10|11|12;groupBySubject:boolean;includeImages:boolean;includeRecallQuestions:boolean;sort:'newest'|'oldest'|'title'};
export type PdfCollections={articles:Article[];examples:Article[]};
export function defaultPdfSettings(collection:'articles'|'examples'='articles'):PdfSettings{
 return {collection,subjectMode:'all',subjects:[],orientation:'portrait',columns:2,paper:'A4',palette:'warm',fontSize:11,groupBySubject:true,includeImages:true,includeRecallQuestions:false,sort:'newest'};
}
export function selectPdfEntries(entries:Article[],settings:PdfSettings):Article[]{
 return entries.filter(entry=>{
  const matches=entry.subjects.some(subject=>settings.subjects.includes(subject));
  return settings.subjectMode==='all'||(settings.subjectMode==='include'?matches:!matches);
 }).sort((a,b)=>settings.sort==='title'?a.title.localeCompare(b.title,'en'):((settings.sort==='oldest'?a.newsDate.localeCompare(b.newsDate):b.newsDate.localeCompare(a.newsDate))||a.title.localeCompare(b.title,'en')));
}
export function pdfGroups(entries:Article[],settings:PdfSettings):{subject:string;entries:Article[]}[]{
 const selected=selectPdfEntries(entries,settings);
 if(!settings.groupBySubject)return [{subject:'',entries:selected}];
 const groups=new Map<string,Article[]>();
 for(const entry of selected){
  // Print each entry once even when it belongs to several subjects.
  const subjects=entry.subjects.filter(subject=>settings.subjectMode!=='include'||settings.subjects.includes(subject)).sort((a,b)=>a.localeCompare(b,'en'));
  const subject=subjects[0]||entry.subjects[0];
  groups.set(subject,[...(groups.get(subject)||[]),entry]);
 }
 return Array.from(groups,([subject,entries])=>({subject,entries})).sort((a,b)=>a.subject.localeCompare(b.subject,'en'));
}
