import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireEnv } from './send-telegram.mjs';

test('env未設定時は例外を投げる', () => {
  assert.throws(() => requireEnv({}), /未設定/);
});

test('env設定時はtokenとchatIdを返す', () => {
  const r = requireEnv({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c' });
  assert.deepEqual(r, { token: 't', chatId: 'c' });
});
