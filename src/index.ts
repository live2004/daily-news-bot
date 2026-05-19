import 'dotenv/config';
import { collectArticles, type Article } from './feeds.js';
import { summarizeArticles, type SummarizedArticle } from './summarizer.js';
import { buildHtml, sendMail } from './mailer.js';

async function main() {
  console.log('[main] Start at', new Date().toISOString());

  const buckets = await collectArticles();
  const totalFetched = Object.values(buckets).flat().length;
  console.log(`[main] Fetched ${totalFetched} articles across categories`);

  if (totalFetched === 0) {
    console.warn('[main] No articles found. Skipping LLM and mail.');
    return;
  }

  // カテゴリ別に順次要約（Gemini無料枠レートリミット対策）
  const summarized: Record<Article['category'], SummarizedArticle[]> = {
    XRP: [], Crypto: [], AI: [], Tech: [],
  };
  for (const k of Object.keys(buckets) as Article['category'][]) {
    summarized[k] = await summarizeArticles(buckets[k]);
  }

  const html = buildHtml(summarized);
  await sendMail(html);

  console.log('[main] Done at', new Date().toISOString());
}

main().catch((err) => {
  console.error('[main] Fatal error:', err);
  process.exit(1);
});
