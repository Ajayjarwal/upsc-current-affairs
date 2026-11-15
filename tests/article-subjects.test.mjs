import assert from 'node:assert/strict';
import test from 'node:test';
import { articleSchema, blankArticle, SUBJECTS } from '../app/model.ts';

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
