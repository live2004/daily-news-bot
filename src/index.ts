import 'dotenv/config';
import { collectArticles } from './feeds.js';
import { sendToTelegram } from './telegram.js';

async function main() {
  console.log('[main] Start at', new Date().toISOString());

  const buckets = await collectArticles();
  const totalFetched = Object.values(buckets).flat().length;
  console.log(`[main] Fetched ${totalFetched} articles across categories`);

  if (totalFetched === 0) {
    console.warn('[main] No articles found. Skipping Telegram post.');
    return;
  }

  await sendToTelegram(buckets);

  console.log('[main] Done at', new Date().toISOString());
}

main().catch((err) => {
  console.error('[main] Fatal error:', err);
  process.exit(1);
});
