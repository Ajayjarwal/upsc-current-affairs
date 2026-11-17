import { z } from 'zod';
import { articleSchema, today, type Article } from './model';

export const EXAMPLE_PAPERS = ['GS I', 'GS II', 'GS III', 'GS IV'];
export const EXAMPLE_TOPIC_SUGGESTIONS = ['Water & sanitation', 'Poverty', 'Education', 'Health', 'Women empowerment', 'Social inclusion', 'Local governance', 'Climate adaptation', 'Accountability', 'Innovation'];
// Reuse the reader's record shape; the date is the date added, not a news date.
export const exampleSchema = z.preprocess(value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return { newsDate: today(), ...value };
}, articleSchema).superRefine((entry, ctx) => {
  if (!entry.gsPaper.length || entry.gsPaper.some(paper => !EXAMPLE_PAPERS.includes(paper))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gsPaper'], message: 'Choose at least one GS paper (GS I–IV).' });
  }
});
export const blankExample = (): Article => ({
  id: crypto.randomUUID(), title: '', subjects: ['General'], tags: [], newsDate: today(), gsPaper: [], summary: '',
  contentHtml: '<h2>Example</h2><p><br></p><h2>Key facts</h2><ul><li><br></li></ul><h2>Use in an answer</h2><p><br></p>',
  sourceName: '', sourceUrl: '', status: 'Unread', bookmarked: false,
});
export const exampleImportTemplate = {
  schema: 'upsc-examples/1', examples: [{
    id: 'replace-with-unique-example-id', title: 'Replace with a short example title',
    subjects: ['Society & Social Justice'], gsPaper: ['GS II'], tags: ['Water & sanitation', 'Poverty'],
    summary: 'A brief, factual account of the supplied example.',
    contentHtml: '<h2>Example</h2><p>Describe only the example supplied.</p><h2>Key facts</h2><ul><li>Verified fact from the supplied material.</li></ul><h2>Use in an answer</h2><p>Explain what this example illustrates.</p>',
    sourceName: '', sourceUrl: '', status: 'Unread', bookmarked: false,
  }],
};
export const exampleImportPrompt = 'Convert the example I provide into JSON for my UPSC Examples collection. Return only valid JSON with schema "upsc-examples/1" and an examples array. Assign one or more relevant subjects and GS papers (GS I–IV). Suggest a few precise topic tags grounded in the example, such as Water & sanitation, Poverty, Health, Accountability or Local governance; avoid generic or irrelevant tags. Do not invent facts, figures, outcomes, dates or source links. Keep the example and facts crisp. Explain briefly how it could support a mains answer. Use contentHtml for the example, key facts and use in an answer. Preserve any supplied stable ID; otherwise use a unique ID. Allowed subjects: ';
