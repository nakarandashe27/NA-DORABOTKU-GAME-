import { expect, test } from '@playwright/test';

test('сейв переживает сворачивание и перезагрузку', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#screen') !== null);

  const hide = () =>
    page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  const stored = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('save') ?? 'null') as { rev: number; playerId: string } | null);

  await hide();
  await expect.poll(stored).toMatchObject({ rev: 1 });
  const first = await stored();

  // Перезагрузка сама скрывает страницу — игра сохраняется и при этом; поэтому проверяем рост rev, а не точное число.
  await page.reload();
  await hide();
  await expect.poll(async () => (await stored())?.rev ?? 0).toBeGreaterThan(first?.rev ?? 0);
  expect((await stored())?.playerId).toBe(first?.playerId);
});
