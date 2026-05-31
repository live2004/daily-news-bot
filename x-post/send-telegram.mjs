// ローカル/手動送信用のTelegramヘルパ。daily-news-botの.envのトークンを流用する。
// env読み込み(dotenv)と純粋ロジック(requireEnv)を分離し、requireEnvを単体テスト可能にする。
import 'dotenv/config';
import { pathToFileURL } from 'node:url';

export function requireEnv(env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID が未設定です');
  }
  return { token, chatId };
}

export async function sendTelegram(text) {
  const { token, chatId } = requireEnv();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram送信失敗: ${JSON.stringify(json)}`);
  return json;
}

// CLI: node x-post/send-telegram.mjs "送信したい本文"
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const text = process.argv[2] ?? 'x-post-assistant テスト送信';
  sendTelegram(text)
    .then(() => console.log('送信OK'))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
