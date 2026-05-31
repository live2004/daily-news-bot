# x-post-assistant

X投稿の下書きを Claude が半自動生成し、Telegram に届ける（人が承認して投稿）。

## 構成
- `charcount.mjs` — 文字数カウンタ（コードポイント数・140字判定）
- `note-articles.json` — note記事カタログ（routine が WebFetch で取得）
- `send-telegram.mjs` — ローカル送信ヘルパ（.env のトークン流用）
- `persona.md` — SNS戦略家ペルソナ/制約
- `routine-morning.md` / `routine-evening.md` — schedule スキルに貼る実行プロンプト

## セットアップ手順
1. `note-articles.json` の `url` を実際の note 記事URLに差し替えてコミット&プッシュ。
   raw URL が公開取得できることを確認:
   `curl -s https://raw.githubusercontent.com/live2004/daily-news-bot/main/x-post/note-articles.json | head`
   ※ リポジトリが private で 404 の場合は、routine 登録時にカタログJSONをプロンプトへ直接貼り付ける。
2. Telegram 接続確認: `node send-telegram.mjs "接続テスト"` を実行し、スマホに届くことを確認
   （`daily-news-bot/.env` の TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID を使用）。
3. `/schedule` スキルで routine を2本登録（下記）。各プロンプト内の
   `<TELEGRAM_BOT_TOKEN>` `<TELEGRAM_CHAT_ID>` を .env と同じ実値に置換し、
   `[persona.md]` 部分に persona.md の本文を貼り付ける。

## routine 登録（cron は UTC）
| routine | 内容 | JST | cron(UTC) |
|---|---|---|---|
| 朝 | 朝便＋昼便 | 07:00 | `0 22 * * *` |
| 夕方 | 夜便 | 18:00 | `0 9 * * *` |

## 運用
1日2回 Telegram に下書きが届く → 確認・微修正 → X に手動投稿（または8:00/12:00/20:00で標準予約）。
昼便はスレッド: 親ポスト投稿 → そのリプライに記事URLを投稿。
記事を入れ替えたら `note-articles.json` を編集してプッシュするだけ。

## 下書きの文字数を手元で確認
`node charcount.mjs "確認したい本文"` → `{"count":n,"ok":true,"limit":140}`
