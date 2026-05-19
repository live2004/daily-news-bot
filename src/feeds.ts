import Parser from 'rss-parser';
import { FEED_SOURCES, KEYWORDS, MAX_ARTICLES_PER_CATEGORY, LOOKBACK_HOURS, type FeedSource } from './config.js';

export interface Article {
  title: string;
  link: string;
  pubDate: Date;
  summary: string;
  source: string;
  category: 'XRP' | 'Crypto' | 'AI' | 'Tech';
}

const parser = new Parser({ timeout: 15000 });

function classifyArticle(text: string, defaultCategory: FeedSource['category']): Article['category'] {
  const lower = text.toLowerCase();
  if (KEYWORDS.XRP.some((k) => lower.includes(k))) return 'XRP';
  if (KEYWORDS.AI.some((k) => lower.includes(k))) return 'AI';
  if (KEYWORDS.Crypto.some((k) => lower.includes(k))) return 'Crypto';
  if (KEYWORDS.Tech.some((k) => lower.includes(k))) return 'Tech';
  return defaultCategory;
}

// タイトルまたはサマリーがこれらのパターンに一致する記事はプロモーション等として除外
const PROMO_PATTERNS = [
  /\bsponsored\b/i,
  /\badvertisement\b/i,
  /\bpromo(tion)?\b/i,
  /\baffiliate\b/i,
  /\bgiveaway\b/i,
  /\bcontest\b/i,
  /\bsweepstakes\b/i,
  /\bdeal(s)?\b/i,
  /\bdiscount\b/i,
  /\bcoupon\b/i,
  /\bbest (buy|price|gift)\b/i,
  /\bhow to (buy|purchase|invest in)\b/i,
  /\bwhere to buy\b/i,
  /\btop \d+ (gift|product|gadget|pick)/i,
  /\bblack friday\b/i,
  /\bcyber monday\b/i,
  /\bpaid partnership\b/i,
  /\bpress release\b/i,
];

function isPromotional(title: string, summary: string): boolean {
  const text = `${title} ${summary}`;
  return PROMO_PATTERNS.some((re) => re.test(text));
}

function stripHtml(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);
}

async function fetchOne(feed: FeedSource): Promise<Article[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const cutoff = Date.now() - LOOKBACK_HOURS * 3600 * 1000;
    const out: Article[] = [];
    for (const item of parsed.items ?? []) {
      const pub = item.isoDate
        ? new Date(item.isoDate)
        : item.pubDate
        ? new Date(item.pubDate)
        : null;
      if (!pub || pub.getTime() < cutoff) continue;

      const text = `${item.title ?? ''} ${item.contentSnippet ?? item.content ?? ''}`;
      out.push({
        title:    (item.title ?? '').trim(),
        link:     item.link ?? '',
        pubDate:  pub,
        summary:  stripHtml(item.contentSnippet ?? item.content),
        source:   feed.source,
        category: classifyArticle(text, feed.category),
      });
    }
    return out;
  } catch (err) {
    console.error(`[feeds] Failed to fetch ${feed.source}:`, (err as Error).message);
    return [];
  }
}

export async function collectArticles(): Promise<Record<Article['category'], Article[]>> {
  const all = (await Promise.all(FEED_SOURCES.map(fetchOne))).flat();

  // URLで重複排除（最初に出てきたものを残す）
  const seen = new Set<string>();
  const deduped = all.filter((a) => {
    if (!a.link || seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  // プロモーション・テーマ無関係記事を除外
  const filtered = deduped.filter((a) => {
    if (isPromotional(a.title, a.summary)) {
      console.log(`[feeds] Filtered (promo): ${a.title}`);
      return false;
    }
    return true;
  });

  const bucket: Record<Article['category'], Article[]> = { XRP: [], Crypto: [], AI: [], Tech: [] };
  for (const a of filtered) bucket[a.category].push(a);

  for (const k of Object.keys(bucket) as Article['category'][]) {
    bucket[k].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
    bucket[k] = bucket[k].slice(0, MAX_ARTICLES_PER_CATEGORY);
  }
  return bucket;
}
