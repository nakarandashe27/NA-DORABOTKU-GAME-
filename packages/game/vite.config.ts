import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const build = process.env.GITHUB_SHA?.slice(0, 7) ?? (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  // Свой домен → '/'. Пока домена нет, Pages отдаёт игру по /<репозиторий>/ — BASE_PATH задаёт деплой.
  base: process.env.BASE_PATH ?? '/',
  define: { __BUILD__: JSON.stringify(build) },
  build: { target: 'es2022' },
});
