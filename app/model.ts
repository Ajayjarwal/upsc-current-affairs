import { z } from 'zod';
export const SUBJECTS = ['Agriculture','Economy','Environment & Ecology','Ethics','Geography','History','Internal Security','International Relations','Polity & Governance','Science & Technology','Society & Social Justice'];
const legacySubjects = new Map([['General','Agriculture'],['Security','Internal Security'],['History & Culture','History'],['Ethics & Integrity','Ethics']]);
export const PAPERS = ['GS I','GS II','GS III','GS IV','Prelims'];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d=new Date(s+'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0,10)===s; },'Use a valid news date');
const subject = z.enum(SUBJECTS as [string,...string[]]);
export const articleSchema = z.preprocess(value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const article = value as Record<string,unknown>;
  // Keep existing records and older JSON imports compatible with renamed subjects.
  const subjects=article.subjects ?? (typeof article.subject === 'string' ? [article.subject] : article.subject);
  return {...article,subjects:Array.isArray(subjects)?subjects.map(value=>typeof value==='string'?legacySubjects.get(value)??value:value):subjects};
}, z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string().trim().min(1).max(300),
  subjects: z.array(subject).min(1,'Choose at least one subject').max(SUBJECTS.length).transform(values=>[...new Set(values)].sort((a,b)=>a.localeCompare(b,'en'))),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  newsDate: date,
  gsPaper: z.array(z.enum(PAPERS as [string,...string[]])).max(5).default([]),
  summary: z.string().max(2000).default(''),
  recallQuestion: z.string().trim().max(500,'Keep the recall question within 500 characters.').optional(),
  contentHtml: z.string().min(1).max(1_500_000,'This article has too many images. Remove an image or use image URLs.'),
  sourceName: z.string().max(150).default(''),
  sourceUrl: z.union([z.literal(''),z.string().url().max(2000).refine(s=>/^https?:\/\//i.test(s),'Use an http or https URL')]).default(''),
  status: z.enum(['Unread','Read','Revised']).default('Unread'),
  bookmarked: z.boolean().default(false),
}).superRefine((article,ctx)=>{
  if(new TextEncoder().encode(JSON.stringify(article)).length>1_800_000)ctx.addIssue({code:z.ZodIssueCode.custom,path:['contentHtml'],message:'This article is too large. Remove an image or use image URLs.'});
}));
export type Article = z.infer<typeof articleSchema> & {createdAt?:string;updatedAt?:string};
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const blankArticle = ():Article => ({id:crypto.randomUUID(),title:'',subjects:['Agriculture'],tags:[],newsDate:today(),gsPaper:[],summary:'',contentHtml:'<h2>Why in news?</h2><p><br></p><h2>Key facts</h2><ul><li><br></li></ul><h2>Background & syllabus connection</h2><p><br></p><h2>Prelims pointers</h2><ul><li><br></li></ul><h2>Mains relevance</h2><p><br></p>',sourceName:'',sourceUrl:'',status:'Unread',bookmarked:false});
