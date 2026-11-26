import assert from 'node:assert/strict';
import test from 'node:test';
import { articleSchema, blankArticle, SUBJECTS, formatNewsDate } from '../app/model.ts';

const sample = () => ({...blankArticle(), title:'Research and economic development'});

test('multiple subjects survive the storage/export JSON round trip', () => {
  const article = articleSchema.parse({...sample(), subjects:['Economy','Science & Technology']});
  assert.deepEqual(articleSchema.parse(JSON.parse(JSON.stringify(article))).subjects, article.subjects);
});

test('legacy saved notes and imports retain their single subject', () => {
  const {subjects, ...legacy} = sample();
  const article = articleSchema.parse({...legacy, subject:'Economy'});
  assert.deepEqual(article.subjects, ['Economy']);
  assert.equal('subject' in article, false);
});

test('legacy subject arrays are accepted and canonical subjects take precedence', () => {
  const {subjects, ...legacy} = sample();
  assert.deepEqual(articleSchema.parse({...legacy, subject:['Economy','Geography']}).subjects, ['Economy','Geography']);
  assert.deepEqual(articleSchema.parse({...legacy, subject:'Economy', subjects:['Geography']}).subjects, ['Geography']);
});

test('subjects must contain at least one supported subject', () => {
  assert.equal(articleSchema.safeParse({...sample(), subjects:[]}).success, false);
  assert.equal(articleSchema.safeParse({...sample(), subjects:['Unsupported']}).success, false);
  assert.equal(articleSchema.safeParse({...sample(), subjects:undefined}).success, false);
  assert.equal(articleSchema.safeParse({...sample(), subjects:SUBJECTS}).success, true);
});

test('duplicate subjects are normalized to keep subject counts accurate', () => {
  assert.deepEqual(articleSchema.parse({...sample(), subjects:['Economy','Economy','Geography']}).subjects, ['Economy','Geography']);
});

test('subject choices use the new names in alphabetical order', () => {
  assert.deepEqual(SUBJECTS,[...SUBJECTS].sort((a,b)=>a.localeCompare(b,'en')));
  for(const value of ['Agriculture','Internal Security','History','Ethics'])assert.ok(SUBJECTS.includes(value));
  for(const value of ['General','Security','History & Culture','Ethics & Integrity'])assert.ok(!SUBJECTS.includes(value));
  assert.deepEqual(blankArticle().subjects,['Agriculture']);
});

test('old names in saved records and imports map to new subjects without losing content', () => {
  const old={...sample(),subjects:['Security','General','History & Culture','Ethics & Integrity','Economy']};
  const parsed=articleSchema.parse(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(parsed.subjects,['Agriculture','Economy','Ethics','History','Internal Security']);
  assert.equal(parsed.title,old.title);
  assert.equal(parsed.contentHtml,old.contentHtml);
  assert.deepEqual(articleSchema.parse({...old,subjects:['Agriculture','General','Internal Security','Security']}).subjects,['Agriculture','Internal Security']);
  const {subjects,...legacy}=old;
  assert.deepEqual(articleSchema.parse({...legacy,subject:'History & Culture'}).subjects,['History']);
});

test('selected subjects are alphabetised on save and export without mutating the input', () => {
  const subjects=['Society & Social Justice','Agriculture','Polity & Governance'];
  const parsed=articleSchema.parse({...sample(),subjects});
  assert.deepEqual(parsed.subjects,['Agriculture','Polity & Governance','Society & Social Justice']);
  assert.deepEqual(subjects,['Society & Social Justice','Agriculture','Polity & Governance']);
  assert.deepEqual(articleSchema.parse(JSON.parse(JSON.stringify(parsed))).subjects,parsed.subjects);
});

test('month-only dates retain their precision while invalid dates are rejected', () => {
  assert.equal(articleSchema.parse({...sample(),newsDate:'2026-08'}).newsDate,'2026-08');
  assert.equal(formatNewsDate('2026-08'),'August 2026');
  assert.match(formatNewsDate('2026-08-15',true),/15 August 2026/);
  for(const newsDate of ['2026-00','2026-13','2026-8','2026-02-29','2026-08-00']){
    assert.equal(articleSchema.safeParse({...sample(),newsDate}).success,false,newsDate);
  }
});
