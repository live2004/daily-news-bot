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
