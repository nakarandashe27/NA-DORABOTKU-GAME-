import { defineConfig, devices } from '@playwright/test';

// Смоук и рендер на собранной игре — context/architecture/07-нефункциональные/тестирование.md
export default defineConfig({
  testDir: 'tests/e2e',
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 640 }, channel: 'chromium' } }],
  webServer: {
    command: 'npm run build && npm run preview -w @nd/game -- --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
