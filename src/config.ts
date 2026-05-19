export interface FeedSource {
  url: string;
  source: string;
  category: 'XRP' | 'Crypto' | 'AI' | 'Tech';
}

export const FEED_SOURCES: FeedSource[] = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk',        category: 'Crypto' },
  { url: 'https://cointelegraph.com/rss',                   source: 'CoinTelegraph',    category: 'Crypto' },
  { url: 'https://decrypt.co/feed',                         source: 'Decrypt',          category: 'Crypto' },
  { url: 'https://www.technologyreview.com/feed/',          source: 'MIT Tech Review',  category: 'AI'     },
  { url: 'https://venturebeat.com/category/ai/feed/',       source: 'VentureBeat AI',   category: 'AI'     },
  { url: 'https://techcrunch.com/feed/',                    source: 'TechCrunch',       category: 'Tech'   },
  { url: 'https://www.theverge.com/rss/index.xml',          source: 'The Verge',        category: 'Tech'   },
  { url: 'https://www.wired.com/feed/rss',                  source: 'Wired',            category: 'Tech'   },
];

export const KEYWORDS = {
  XRP:    ['xrp', 'ripple', 'xrpl'],
  Crypto: ['bitcoin', 'btc', 'ethereum', 'eth', 'blockchain', 'crypto', 'defi', 'stablecoin', 'sec', 'etf'],
  AI:     ['ai ', ' ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'gemini', 'openai', 'anthropic', 'machine learning', 'neural'],
  Tech:   ['startup', 'cloud', 'cybersecurity', 'semiconductor', 'chip', 'quantum'],
} as const;

export const MAX_ARTICLES_PER_CATEGORY = 5;
export const LOOKBACK_HOURS = 24;
