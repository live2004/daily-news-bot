import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countChars, check, LIMIT } from './charcount.mjs';

test('LIMITは140', () => {
  assert.equal(LIMIT, 140);
});

test('ASCIIは1字ずつ数える', () => {
  assert.equal(countChars('hello'), 5);
});

test('日本語(全角)も1字ずつ数える', () => {
  assert.equal(countChars('こんにちは世界'), 7);
});

test('単一コードポイントの絵文字は1字', () => {
  assert.equal(countChars('🚀'), 1);
});

test('140字ちょうどはok=true', () => {
  const s = 'あ'.repeat(140);
  assert.deepEqual(check(s), { count: 140, ok: true, limit: 140 });
});

test('141字はok=false', () => {
  const s = 'あ'.repeat(141);
  const r = check(s);
  assert.equal(r.count, 141);
  assert.equal(r.ok, false);
});

test('空文字は0字でok=true', () => {
  assert.deepEqual(check(''), { count: 0, ok: true, limit: 140 });
});
