import assert from 'node:assert/strict';
import test from 'node:test';
import { imageMarkup, safeImageSource, prepareArticleImage, MAX_EMBEDDED_IMAGE_LENGTH } from '../app/images.ts';
import { articleSchema, blankArticle } from '../app/model.ts';

test('images accept web URLs and embedded raster images', () => {
  assert.equal(safeImageSource(' https://example.com/photo.png '), 'https://example.com/photo.png');
  assert.equal(safeImageSource('data:image/png;base64,aGVsbG8='), 'data:image/png;base64,aGVsbG8=');
  for (const source of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','file:///tmp/photo.png','blob:https://example.com/image','/relative-image.png','not-a-url']) {
    assert.equal(safeImageSource(source), null);
    assert.throws(() => imageMarkup(source));
  }
  assert.equal(safeImageSource('data:image/png;base64,'+'A'.repeat(MAX_EMBEDDED_IMAGE_LENGTH)), null);
});

test('image descriptions and sources cannot inject HTML attributes or elements', () => {
  const html = imageMarkup('https://example.com/image.png?x=1&y=2', '"><script>alert(1)</script>');
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /x=1&amp;y=2/);
  assert.match(html, /<figcaption>/);
});

test('unsupported uploads and oversized files are rejected before decoding', async () => {
  await assert.rejects(prepareArticleImage({type:'image/svg+xml',size:100}), /PNG, JPG or WebP/);
  await assert.rejects(prepareArticleImage({type:'image/png',size:10_000_001}), /10 MB/);
});

test('embedded images larger than the former HTML limit survive article export/import', () => {
  const contentHtml=imageMarkup('data:image/webp;base64,'+'A'.repeat(160_000),'Research diagram');
  const article=articleSchema.parse({...blankArticle(),title:'Image article',contentHtml});
  assert.equal(articleSchema.parse(JSON.parse(JSON.stringify(article))).contentHtml,contentHtml);
});

test('article limits reserve room below the database row limit, including UTF-8 text', () => {
  const article={...blankArticle(),title:'Image article'};
  assert.equal(articleSchema.safeParse({...article,contentHtml:'A'.repeat(1_500_001)}).success,false);
  assert.equal(articleSchema.safeParse({...article,contentHtml:'अ'.repeat(610_000)}).success,false);
});
