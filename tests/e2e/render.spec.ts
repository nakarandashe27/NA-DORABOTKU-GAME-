import { expect, test, type Page } from '@playwright/test';

async function debugResult(page: Page, mode: string) {
  await page.goto(`/?debug=${mode}`);
  await page.waitForFunction(() => (window as unknown as { __debug?: unknown }).__debug !== undefined);
  return page.evaluate(() => (window as unknown as { __debug: { diff?: number; nonEmpty?: boolean; error?: string } }).__debug);
}

test('один буфер → одинаковый вывод в WebGL2 и Canvas2D', async ({ page }) => {
  const r = await debugResult(page, 'compare');
  expect(r.error).toBeUndefined();
  expect(r.nonEmpty).toBe(true);
  expect(r.diff).toBeLessThan(0.01);
});

test('WebGL2 переживает потерю контекста', async ({ page }) => {
  const r = await debugResult(page, 'contextloss');
  expect(r.error).toBeUndefined();
  expect(r.nonEmpty).toBe(true);
  expect(r.diff).toBeLessThan(0.01);
});

for (const renderer of ['webgl2', 'canvas'] as const) {
  test(`лист-заглушка рисуется (${renderer}) на 360×640`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/?renderer=${renderer}`);
    const canvas = page.locator('#screen');
    await expect(canvas).toBeVisible();
    // Есть нарисованные (не фоновые) пиксели.
    await expect
      .poll(() =>
        page.evaluate(() => {
          // Перерисовка и чтение в одной задаче: webgl-буфер очищается после кадра.
          window.dispatchEvent(new Event('resize'));
          const c = document.querySelector<HTMLCanvasElement>('#screen');
          if (!c) return 0;
          const copy = document.createElement('canvas');
          copy.width = c.width;
          copy.height = c.height;
          const ctx = copy.getContext('2d');
          ctx?.drawImage(c, 0, 0);
          const d = ctx?.getImageData(0, 0, copy.width, copy.height).data ?? new Uint8ClampedArray();
          let lit = 0;
          for (let i = 0; i < d.length; i += 4) if ((d[i] ?? 0) + (d[i + 1] ?? 0) + (d[i + 2] ?? 0) > 120) lit++;
          return lit;
        }),
      )
      .toBeGreaterThan(500);
    expect(errors).toEqual([]);
  });
}
