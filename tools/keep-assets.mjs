// Хранение ассетов прошлых сборок на GitHub Pages — context/architecture/07-нефункциональные/деплой.md
// Telegram WebView держит старый index.html; если удалить его хешированные файлы — белый экран.
// Скрипт переносит в новую сборку ассеты последних KEEP-1 прошлых деплоев и пишет историю.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const KEEP = 3;
const HISTORY = 'assets-history.json';

/** history: массив списков файлов, свежий первым. Возвращает, что скопировать из старого и новую историю. */
export function planKeep(oldHistory, newFiles, keep = KEEP) {
  const previous = oldHistory.slice(0, keep - 1);
  const fresh = new Set(newFiles);
  const toCopy = [...new Set(previous.flat())].filter((f) => !fresh.has(f));
  return { toCopy, history: [newFiles, ...previous] };
}

export function keepAssets(oldDir, distDir) {
  const distAssets = join(distDir, 'assets');
  const newFiles = existsSync(distAssets) ? readdirSync(distAssets).sort() : [];
  const historyPath = join(oldDir, HISTORY);
  const oldHistory = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, 'utf8')) : [];
  const { toCopy, history } = planKeep(oldHistory, newFiles);
  mkdirSync(distAssets, { recursive: true });
  for (const f of toCopy) {
    const src = join(oldDir, 'assets', f);
    if (existsSync(src)) copyFileSync(src, join(distAssets, f));
  }
  writeFileSync(join(distDir, HISTORY), JSON.stringify(history, null, 1));
  return toCopy.length;
}

if (process.argv[1]?.endsWith('keep-assets.mjs')) {
  const [oldDir, distDir] = process.argv.slice(2);
  if (!oldDir || !distDir) throw new Error('usage: node tools/keep-assets.mjs <old-pages-dir> <dist-dir>');
  console.log(`kept ${keepAssets(oldDir, distDir)} old assets`);
}
