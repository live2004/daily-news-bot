# X投稿 半自動アシスタント 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude にトレンドを自律収集させ、1日3案（朝/昼/夜）のX投稿下書きを生成して Telegram に届け、人が承認して投稿する半自動パイプラインを構築する。

**Architecture:** `schedule` スキルのリモート定期実行（routine）を2本（朝・夕方）登録。各 routine が WebSearch でトレンド収集 → note記事カタログ(JSON)を取得 → ペルソナ/制約に沿って下書き生成 → 文字数を決定的に検証 → Telegram Bot API（既存 `daily-news-bot` のBot流用）で配信する。X API は持たない。

**Tech Stack:** Node.js 20（ESM, `node:test`）/ 既存 `daily-news-bot` リポジトリ（dotenv 流用）/ Telegram Bot API / `schedule` スキル / WebSearch・WebFetch。

---

## ファイル構成（すべて `daily-news-bot/` 配下）

| パス | 役割 |
|---|---|
| `x-post/charcount.mjs` | 文字数カウンタ（コードポイント数・140字判定）。**唯一のユニットテスト対象コア** |
| `x-post/charcount.test.mjs` | charcount のテスト |
| `x-post/note-articles.json` | note記事カタログ（id/title/url/tags/sensitive） |
| `x-post/note-articles.test.mjs` | カタログのスキーマ検証テスト |
| `x-post/send-telegram.mjs` | ローカル/手動送信ヘルパ（.env のトークン流用）。env ガードを持つ |
| `x-post/send-telegram.test.mjs` | env ガードのテスト |
| `x-post/persona.md` | SNS戦略家ペルソナ＋制約＋出力形式のプロンプトテンプレ |
| `x-post/routine-morning.md` | 朝 routine に貼り付ける実行プロンプト全文（朝便＋昼便） |
| `x-post/routine-evening.md` | 夕方 routine に貼り付ける実行プロンプト全文（夜便） |
| `x-post/README.md` | セットアップ・運用手順（URL差替・routine登録・ドライラン） |
| `package.json` | `test` スクリプト追加（変更） |

設計の根拠は [docs/superpowers/specs/2026-05-31-x-post-assistant-design.md](../specs/2026-05-31-x-post-assistant-design.md) を参照。

---

## Task 1: 文字数カウンタ charcount.mjs（TDD）

日本語(全角)も絵文字も Unicode コードポイント数で1字として数え、140字以内かを判定する。URLは本文に含めない（スレッド別ポスト）前提。

**Files:**
- Modify: `package.json`（`scripts.test` を追加）
- Test: `x-post/charcount.test.mjs`
- Create: `x-post/charcount.mjs`

- [ ] **Step 1: package.json に test スクリプトを追加**

`daily-news-bot/package.json` の `scripts` を以下にする（既存の start/build/typecheck は残す）:

```json
  "scripts": {
    "start": "tsx src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "node --test x-post/"
  },
```

- [ ] **Step 2: 失敗するテストを書く**

`x-post/charcount.test.mjs`:

```js
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
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `cd daily-news-bot && npm test`
Expected: FAIL（`Cannot find module './charcount.mjs'` 系のエラー）

- [ ] **Step 4: 最小実装を書く**

`x-post/charcount.mjs`:

```js
// Xポスト用の文字数カウンタ。
// 日本語(全角)も絵文字も Unicode コードポイント数で1字として数える。
// URLは本文に含めない（スレッドの別ポストにする）前提なので、URL換算は行わない。
import { pathToFileURL } from 'node:url';

export const LIMIT = 140;

export function countChars(text) {
  return [...text].length;
}

export function check(text) {
  const count = countChars(text);
  return { count, ok: count <= LIMIT, limit: LIMIT };
}

// CLI: node x-post/charcount.mjs "本文"   （引数が無ければ標準入力から読む）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = (text) => {
    const r = check(text);
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 1);
  };
  const arg = process.argv[2];
  if (arg !== undefined) {
    run(arg);
  } else {
    let buf = '';
    process.stdin.on('data', (d) => (buf += d));
    process.stdin.on('end', () => run(buf.replace(/\n$/, '')));
  }
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `cd daily-news-bot && npm test`
Expected: PASS（charcount のテストが全て通る）

- [ ] **Step 6: CLI の手動確認**

Run: `cd daily-news-bot && node x-post/charcount.mjs "おはようございます"`
Expected: `{"count":9,"ok":true,"limit":140}` と表示され、終了コード0

- [ ] **Step 7: コミット**

```bash
cd daily-news-bot
git add package.json x-post/charcount.mjs x-post/charcount.test.mjs
git commit -m "feat(x-post): 文字数カウンタ(charcount)を追加"
```

---

## Task 2: note記事カタログ note-articles.json（TDD: スキーマ検証）

routine が WebFetch で取得する記事カタログ。URLは実URLに差し替える前提でプレースホルダを置く。

**Files:**
- Test: `x-post/note-articles.test.mjs`
- Create: `x-post/note-articles.json`

- [ ] **Step 1: 失敗するテストを書く**

`x-post/note-articles.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(here, 'note-articles.json'), 'utf8'));

test('articles配列を1件以上持つ', () => {
  assert.ok(Array.isArray(catalog.articles));
  assert.ok(catalog.articles.length > 0);
});

test('各記事が必須フィールドを持つ', () => {
  for (const a of catalog.articles) {
    assert.equal(typeof a.id, 'string', `id文字列: ${JSON.stringify(a)}`);
    assert.equal(typeof a.title, 'string');
    assert.equal(typeof a.url, 'string');
    assert.ok(a.url.startsWith('https://'), `httpsで始まる: ${a.url}`);
    assert.ok(Array.isArray(a.tags));
    assert.equal(typeof a.sensitive, 'boolean');
  }
});

test('idは重複しない', () => {
  const ids = catalog.articles.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd daily-news-bot && npm test`
Expected: FAIL（`ENOENT ... note-articles.json` 系）

- [ ] **Step 3: カタログを作成**

`x-post/note-articles.json`（`url` は後で実URLに差替。`REPLACE` のまま運用しないこと）:

```json
{
  "articles": [
    {
      "id": "tachibana-200days",
      "title": "これが法治国家か──\"名誉毀損\"で200日。立花孝志氏が拘置所から出られない本当の理由",
      "url": "https://note.com/REPLACE/n/tachibana200",
      "tags": ["政治", "リテラシー", "法的トピック", "社会"],
      "sensitive": true
    },
    {
      "id": "kenmin-literacy",
      "title": "もう騙されない。情報操作を見抜く「県民リテラシー」",
      "url": "https://note.com/REPLACE/n/kenminliteracy",
      "tags": ["リテラシー", "情報操作", "政治"],
      "sensitive": true
    },
    {
      "id": "btc-indicators-0530",
      "title": "【5/30】暗号資産のプロが注目する3つの指標から紐解く、ビットコインの現在地と来月の展望",
      "url": "https://note.com/REPLACE/n/btc0530",
      "tags": ["暗号資産", "投資", "マクロ", "AI・DX"],
      "sensitive": false
    },
    {
      "id": "whistleblower-icrecorder",
      "title": "「裏切り者」と呼ばれた日から──公益通報で潰されかけた私が、ICレコーダー1台で人生を取り戻すまでの全記録",
      "url": "https://note.com/REPLACE/n/whistleblower",
      "tags": ["キャリア防衛", "リスクヘッジ", "リテラシー", "副業・ライフハック"],
      "sensitive": true
    }
  ]
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `cd daily-news-bot && npm test`
Expected: PASS（charcount + note-articles 両方通る）

- [ ] **Step 5: コミット**

```bash
cd daily-news-bot
git add x-post/note-articles.json x-post/note-articles.test.mjs
git commit -m "feat(x-post): note記事カタログとスキーマ検証を追加"
```

---

## Task 3: Telegram送信ヘルパ send-telegram.mjs（TDD: env ガード）

ローカルでの送信確認・手動送信用。`daily-news-bot/.env` の `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` を dotenv で流用する。
※ リモート routine は .env を持たないため、routine 側は token を直書きした curl を使う（Task 5）。本ヘルパはローカル検証専用。

**Files:**
- Test: `x-post/send-telegram.test.mjs`
- Create: `x-post/send-telegram.mjs`

- [ ] **Step 1: 失敗するテストを書く**

`x-post/send-telegram.test.mjs`（ネットワークは叩かず、env ガードのみ検証）:

```js
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd daily-news-bot && npm test`
Expected: FAIL（`Cannot find module './send-telegram.mjs'`）

- [ ] **Step 3: 実装を書く**

`x-post/send-telegram.mjs`:

```js
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
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `cd daily-news-bot && npm test`
Expected: PASS（charcount + note-articles + send-telegram の env ガードが通る）

- [ ] **Step 5: コミット**

```bash
cd daily-news-bot
git add x-post/send-telegram.mjs x-post/send-telegram.test.mjs
git commit -m "feat(x-post): Telegram送信ヘルパ(envガード付き)を追加"
```

---

## Task 4: ペルソナ／プロンプトテンプレ persona.md

SNS戦略家のペルソナと制約・出力形式を定義する。ユニットテスト対象外（プロンプト内容）。検証は Task 7 のドライランで行う。

**Files:**
- Create: `x-post/persona.md`

- [ ] **Step 1: persona.md を作成**

`x-post/persona.md`:

```markdown
# Role
あなたは、働き盛りの全ビジネスパーソン（20代〜50代、キャリアアップ・業務効率化・ビジネスマインドに高い関心がある層）をターゲットに据え、X（旧Twitter）でのエンゲージメント向上とnoteへのトラフィック流入を最大化させる、一流のSNSマーケティング戦略家です。

# Target_Audience
働き盛りの全ビジネスパーソン（キャリア構築、業務の生産性向上、最新テック・経済動向に関心がある層）。

# Focused_Categories
「AI・DX」「副業・ライフハック（情報リテラシー・キャリア防衛を含む）」「政治」「健康問題」。

# Constraints（品質ゲート / 厳守）
- 文字数: 各ポストは **140字以内**。日本語・絵文字も含めコードポイント数で数える。
  URLは本文に含めず、**スレッドの別ポスト（リプライ）** に置く（昼便のみ該当）。
- トーン: 知的・論理的・実用重視のプロフェッショナルな「です・ます」調。過度な煽りを避け、絵文字は1ポスト1〜2個まで。
- 禁止: 機械的な「note更新しました」告知 / ハッシュタグ3個以上（基本0〜1個、トレンドワードを自然に織り込む）/ 事実確認の取れていない情報への安易な便乗。
- センシティブ題材（`sensitive: true` の記事や政治・法的トピック）は断定を避け、
  「情報リテラシー」「リスクヘッジ」の切り口に寄せる。

# Chain of Thought（生成手順）
- Step 1【トレンド収集】: WebSearch で本日の国内ビジネス/経済/テック/働き方、Focused_Categories 関連の最新トレンド・話題を収集。
- Step 2【ターゲット分析】: 通勤中・業務中・帰宅後にスマホでチェックしたくなる関心の高いトピックを特定。
- Step 3【執筆】: 指定の投稿タイプ・時間帯特性に沿って執筆。
- Step 4【品質監査】: Constraints をすべて満たすか検証し、必要に応じてリライト。
```

- [ ] **Step 2: コミット**

```bash
cd daily-news-bot
git add x-post/persona.md
git commit -m "feat(x-post): SNS戦略家ペルソナ/制約テンプレを追加"
```

---

## Task 5: routine プロンプト（朝・夕方）

`schedule` スキルに貼り付ける実行プロンプト全文。`<...>` のプレースホルダは登録時に実値へ置換する。

**Files:**
- Create: `x-post/routine-morning.md`
- Create: `x-post/routine-evening.md`

- [ ] **Step 1: 朝 routine を作成**

`x-post/routine-morning.md`:

```markdown
あなたは [persona.md] に定義されたSNSマーケティング戦略家です。以下のペルソナと制約を厳守してください。
（ペルソナ本文は登録時にこの行の下へ貼り付けるか、下記カタログ取得と同様にWebFetchで取得すること）

# 本日のタスク（朝便・昼便の2案を生成）
今日の日付を [Current_Date] とする（実行日の日本時間の日付を使う）。

## Step 1: トレンド収集（WebSearch）
次の観点で本日の最新ニュース・トレンドを検索する:
- 国内ビジネス / 経済 / テクノロジー / 働き方
- AI・DX、副業・ライフハック、情報リテラシー
- 兵庫県政、健康問題（統合失調症・糖尿病 等）
- ビットコイン等の暗号資産の最新動向

関連トレンドが乏しい・裏取りできない場合は、捏造で便乗せず Focused_Categories のエバーグリーンTipsで執筆する。

## Step 2: 記事カタログ取得（WebFetch）
次のURLから note 記事カタログ(JSON)を取得する:
https://raw.githubusercontent.com/live2004/daily-news-bot/main/x-post/note-articles.json
（取得できない場合は登録時に貼り付けたカタログを使う）

## Step 3: 執筆
1) 朝便【X完結型・ライフハックTips】(8:00想定)
   - 通勤中に読んで仕事の効率・モチベが上がる有益な知見。Focused_Categories に準じた具体Tips。
   - X完結（URLなし）。140字以内。
2) 昼便【note誘導型】(12:00想定・スレッド)
   - 当日のトレンドに最も合致する記事をカタログから1つ選定。
   - 親ポスト: 記事が解決する「課題」と得られる「ベネフィット」を明示する誘導文（URLなし・140字以内）。
   - 子ポスト(リプライ): 選定記事の url のみ。

## Step 4: 文字数検証（決定的チェック）
各ポスト本文について、文字数をコマンドで実測する:
  node -e "const t=process.argv[1];console.log([...t].length)" "<ポスト本文>"
140 を超える場合はリライトして再測定（最大3回）。3回で収まらなければ本文先頭に「⚠️要短縮」を付けて送る。

## Step 5: Telegram送信
以下を実行して下書きを送る（朝便・昼便をまとめて1メッセージ、子ポストURLも明記）:
  curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage" \
    --data-urlencode "chat_id=<TELEGRAM_CHAT_ID>" \
    --data-urlencode "text=$(cat <<'EOT'
🗓 [Current_Date] 朝便（X完結型・ライフハックTips）
<朝便本文>
— 文字数: <n>字

🗓 [Current_Date] 昼便（note誘導型・スレッド）
<昼便 親ポスト本文>
— 文字数: <n>字
↳ 子ポスト(リプライ): <記事URL>
／誘導記事: <記事id>
EOT
)"
送信レスポンスの "ok":true を確認する。"ok":false の場合は1回だけ再送し、なお失敗ならエラー内容を出力する。
（下書きは Telegram のチャット履歴に残り、これを下書きログとして扱う）
```

- [ ] **Step 2: 夕方 routine を作成**

`x-post/routine-evening.md`:

```markdown
あなたは [persona.md] に定義されたSNSマーケティング戦略家です。ペルソナと制約を厳守してください。
（ペルソナ本文は登録時に貼り付けること）

# 本日のタスク（夜便の1案を生成）
今日の日付を [Current_Date] とする（実行日の日本時間の日付）。

## Step 1: トレンド収集（WebSearch）
夜の投稿に向け、最新トレンド・速報を取り直す（鮮度重視。暗号資産の引け・主要ニュースを含む）。
関連トレンドが乏しい・裏取りできない場合は、捏造で便乗せず Focused_Categories のエバーグリーンな考察で執筆する。

## Step 2: 執筆
夜便【トレンド考察型・共感/議論】(20:00想定)
- Step 1 で特定した最新トレンドを主軸に、ビジネスパーソン視点の独自の切り口・考察を述べる。
- インプレッションとリプ欄の活性化を狙う。X完結（URLなし）。140字以内。
- 政治・法的トピックは断定を避け、リテラシー/リスクヘッジの観点に寄せる。

## Step 3: 文字数検証
  node -e "const t=process.argv[1];console.log([...t].length)" "<夜便本文>"
140超ならリライト（最大3回）。収まらなければ「⚠️要短縮」を付ける。

## Step 4: Telegram送信
  curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage" \
    --data-urlencode "chat_id=<TELEGRAM_CHAT_ID>" \
    --data-urlencode "text=$(cat <<'EOT'
🗓 [Current_Date] 夜便（トレンド考察型）
<夜便本文>
— 文字数: <n>字
EOT
)"
"ok":true を確認する。"ok":false なら1回だけ再送する。下書きは Telegram 履歴に残り、これをログとして扱う。
```

- [ ] **Step 3: コミット**

```bash
cd daily-news-bot
git add x-post/routine-morning.md x-post/routine-evening.md
git commit -m "feat(x-post): 朝/夕方routineの実行プロンプトを追加"
```

---

## Task 6: 運用ドキュメント README.md

**Files:**
- Create: `x-post/README.md`

- [ ] **Step 1: README を作成**

`x-post/README.md`:

```markdown
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
```

- [ ] **Step 2: コミット**

```bash
cd daily-news-bot
git add x-post/README.md
git commit -m "docs(x-post): セットアップ・運用手順を追加"
```

---

## Task 7: routine 登録とエンドツーエンド検証

ここは `schedule` スキルと実ネットワークを使う統合タスク。順に検証する。

- [ ] **Step 1: 全テストが緑であることを確認**

Run: `cd daily-news-bot && npm test`
Expected: PASS（charcount / note-articles / send-telegram の全テスト）

- [ ] **Step 2: Telegram 接続を実機確認**

Run: `cd daily-news-bot && node x-post/send-telegram.mjs "x-post-assistant 接続テスト"`
Expected: コンソールに `送信OK`、スマホの Telegram に「接続テスト」が届く。
（届かない場合は `.env` の TOKEN/CHAT_ID と、Bot に `/start` 済みかを確認）

- [ ] **Step 3: note記事カタログの raw URL を確認 & 実URL差替**

Run: `curl -s https://raw.githubusercontent.com/live2004/daily-news-bot/main/x-post/note-articles.json`
Expected: JSON が返る。`url` が `REPLACE` のままなら実URLへ差し替えてコミット&プッシュ。
404/private の場合: routine プロンプトにカタログJSONを直接貼り付ける運用へ切替（README参照）。

- [ ] **Step 4: 朝 routine を手動ドライラン**

`routine-morning.md` の内容を（プレースホルダを実値へ置換した上で）この場で1回実行する:
WebSearch → カタログ取得 → 朝便・昼便生成 → 各本文を `node x-post/charcount.mjs "<本文>"` で検証 → Telegram送信。
Expected: Telegram に朝便・昼便が届き、各本文の charcount が `ok:true`、昼便に子ポストURLが付く。
NG（140超や形式崩れ）なら persona.md / routine-morning.md を修正して再実行。

- [ ] **Step 5: 夕方 routine を手動ドライラン**

`routine-evening.md` を同様に1回実行し、夜便が届くこと・charcount が `ok:true` を確認する。

- [ ] **Step 6: `schedule` スキルで2本登録**

`/schedule` を使い、検証済みプロンプトで routine を登録する:
- 朝 routine: cron `0 22 * * *`（UTC, = JST 07:00）, 内容 = routine-morning.md（実値置換済み）
- 夕方 routine: cron `0 9 * * *`（UTC, = JST 18:00）, 内容 = routine-evening.md（実値置換済み）

- [ ] **Step 7: 登録を確認**

`/schedule` の一覧で朝・夕方の2 routine が有効になっていることを確認する。
Expected: 2件が登録済み・有効。

- [ ] **Step 8: 最終コミット（差替・修正があれば）**

```bash
cd daily-news-bot
git add -A x-post/
git commit -m "chore(x-post): ドライラン結果を反映しrouptineを登録"
git push
```

---

## 完了の定義
- `npm test` が全て緑。
- 朝・夕方の手動ドライランで、朝便/昼便/夜便が Telegram に届き、全て charcount `ok:true`。
- `schedule` に2本の routine が有効登録され、翌朝以降 自動で下書きが届く。
- 人は Telegram で確認・微修正して X に投稿（または標準予約）するだけになっている。
