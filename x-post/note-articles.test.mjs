import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(here, 'note-articles.json'), 'utf8'));

test('articles配列を1件以上持つ', () => {
  assert.ok(Array.isArray(catalog.articles));
  assert.ok(catalog.articles.length > 0);
});

test('各記事が必須フィールドを持つ', () => {
  for (const a of catalog.articles) {
    assert.equal(typeof a.id, 'string', `id文字列: ${JSON.stringify(a)}`);
    assert.equal(typeof a.title, 'string');
    assert.equal(typeof a.url, 'string');
    assert.ok(a.url.startsWith('https://'), `httpsで始まる: ${a.url}`);
    assert.ok(Array.isArray(a.tags));
    assert.equal(typeof a.sensitive, 'boolean');
  }
});

test('idは重複しない', () => {
  const ids = catalog.articles.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});
