# daily-news-bot

海外テック・暗号資産ニュースを毎朝自動収集し、Telegramに配信するボット。

## 概要

8つの英語RSSフィードから過去24時間の記事を収集し、XRP / Crypto / AI / Tech の4カテゴリに分類して毎朝6時（JST）にTelegramへ送信します。LLM不要・完全無料で動作します。

## 機能

- **RSSフィード収集** — CoinDesk, CoinTelegraph, Decrypt, MIT Tech Review, VentureBeat AI, TechCrunch, The Verge, Wired
- **自動カテゴリ分類** — キーワードマッチングで XRP / Crypto / AI / Tech に振り分け
- **プロモーション記事フィルタ** — 広告・クーポン・セール系の記事を自動除外
- **重複排除** — 同一URLの記事は1件のみ表示
- **Telegram配信** — Bot APIでHTMLフォーマットのメッセージを送信
- **GitHub Actions自動実行** — 毎朝6時（JST）にcronで起動

## 配信イメージ

```
📰 Daily Tech & Crypto Digest
2026年5月19日(火) · 過去24時間の海外一次情報まとめ

🔵 XRP / Ripple（3件）

📄 Ripple Wins SEC Case...
CoinDesk · 2026/5/19 6:30:00
The U.S. court ruled that...

🟣 人工知能 (AI)（5件）
...
```

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/live2004/daily-news-bot.git
cd daily-news-bot
npm install
```

### 2. Telegram Bot を作成

1. Telegramで [@BotFather](https://t.me/BotFather) を開く
2. `/newbot` と送信してBotを作成
3. 表示された **Token** をコピー
4. 作成したBotに `/start` を送信
5. 以下のURLでChat IDを取得

```
https://api.telegram.org/bot{TOKEN}/getUpdates
```

JSONの `result[0].message.chat.id` の数値がChat IDです。

### 3. 環境変数を設定

`.env.example` をコピーして `.env` を作成：

```bash
cp .env.example .env
```

`.env` を編集：

```
TELEGRAM_BOT_TOKEN=123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_CHAT_ID=123456789
```

### 4. ローカルで動作確認

```bash
npm start
```

TelegramにBotからメッセージが届けば成功です。

## GitHub Actions での自動実行

### Secrets の登録

リポジトリの `Settings > Secrets and variables > Actions` で以下を登録：

| シークレット名 | 値 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFatherから取得したToken |
| `TELEGRAM_CHAT_ID` | getUpdatesで確認したid |

### スケジュール変更

[.github/workflows/daily-news.yml](.github/workflows/daily-news.yml) の cron 式を編集します。

```yaml
- cron: '0 21 * * *'  # UTC 21:00 = JST 6:00
```

| 送信時刻（JST） | cron式（UTC） |
|---|---|
| 毎朝 6:00 | `0 21 * * *` |
| 毎朝 7:00 | `0 22 * * *` |
| 毎朝 8:00 | `0 23 * * *` |

## ファイル構成

```
src/
  config.ts    — RSSフィード一覧・キーワード・設定値
  feeds.ts     — RSSフィード取得・分類・フィルタリング
  telegram.ts  — Telegram Bot API送信
  index.ts     — エントリポイント
.github/
  workflows/
    daily-news.yml  — GitHub Actions cron設定
.env.example        — 環境変数のサンプル
```

## カスタマイズ

### フィードの追加・変更

[src/config.ts](src/config.ts) の `FEED_SOURCES` に追記します：

```typescript
{ url: 'https://example.com/feed', source: 'Example', category: 'Tech' },
```

### カテゴリキーワードの変更

同じく `KEYWORDS` を編集します：

```typescript
XRP: ['xrp', 'ripple', 'xrpl'],
```

### 1カテゴリあたりの最大記事数

```typescript
export const MAX_ARTICLES_PER_CATEGORY = 5;  // デフォルト5件
```

## 技術スタック

- **Runtime** — Node.js 20 + TypeScript
- **RSS取得** — rss-parser
- **配信** — Telegram Bot API（fetch）
- **自動実行** — GitHub Actions
