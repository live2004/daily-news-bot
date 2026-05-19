import type { Article } from './feeds.js';

const CATEGORY_LABEL: Record<Article['category'], string> = {
  XRP:    '🔵 XRP / Ripple',
  Crypto: '🟠 暗号資産 / ブロックチェーン',
  AI:     '🟣 人工知能 (AI)',
  Tech:   '🟢 テクノロジー全般',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)
  );
}

async function sendMessage(token: string, chatId: string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error: ${res.status} ${body}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function sendToTelegram(buckets: Record<Article['category'], Article[]>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID is not set');

  const today = new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  await sendMessage(token, chatId,
    `📰 <b>Daily Tech &amp; Crypto Digest</b>\n${today}\n過去24時間の海外一次情報まとめ`
  );

  for (const category of Object.keys(buckets) as Article['category'][]) {
    const articles = buckets[category];
    if (articles.length === 0) continue;

    await sleep(1000);

    const lines: string[] = [`<b>${CATEGORY_LABEL[category]}（${articles.length}件）</b>\n`];

    for (const a of articles) {
      const title = a.link
        ? `<a href="${escapeHtml(a.link)}">${escapeHtml(a.title)}</a>`
        : escapeHtml(a.title);
      const snippet = a.summary ? `\n${escapeHtml(a.summary.slice(0, 200))}` : '';
      const meta = `<i>${escapeHtml(a.source)} · ${a.pubDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</i>`;
      lines.push(`📄 ${title}\n${meta}${snippet}`);
    }

    await sendMessage(token, chatId, lines.join('\n\n'));
    await sleep(1000);
  }

  console.log('[telegram] Posted to Telegram');
}
