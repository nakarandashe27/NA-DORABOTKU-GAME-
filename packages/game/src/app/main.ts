import { gameInfo } from '../core/version';
import { createBrowserPlatform } from '../platform/browser';
import { isTelegramLaunch } from '../platform/detect';
import { createTelegramPlatform, loadTelegramSdk } from '../platform/telegram';
import type { Platform, ViewportInfo } from '../platform/types';
import { boot } from './boot';

const BOT_LINK = import.meta.env.VITE_BOT_LINK ?? '';

async function pickPlatform(): Promise<Platform> {
  if (!isTelegramLaunch(location.hash, location.search)) return createBrowserPlatform();
  const tg = await loadTelegramSdk();
  return tg ? createTelegramPlatform(tg, BOT_LINK) : createBrowserPlatform();
}

// ponytail: диагностический экран скелета на Canvas2D — заменяется рендером сетки на этапе 4.
function drawDiagnostics(lines: string[], v: ViewportInfo): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#screen');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  canvas.width = Math.round(v.width * v.dpr);
  canvas.height = Math.round(v.height * v.dpr);
  ctx.scale(v.dpr, v.dpr);
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, v.width, v.height);
  ctx.fillStyle = '#9fd29f';
  ctx.font = '14px monospace';
  lines.forEach((line, i) => ctx.fillText(line, 12 + v.safe.left, 28 + v.safe.top + i * 20));
}

async function main(): Promise<void> {
  const t0 = performance.now();
  const platform = await pickPlatform();
  const state = await boot(platform, {
    loadSave: async (stores) => (await stores[0]?.get('save')) ?? null,
    loadContent: async () => null,
  });
  const ms = Math.round(performance.now() - t0);

  const render = (v: ViewportInfo) =>
    drawDiagnostics(
      [
        gameInfo.title,
        `канал: ${state.launch.channel}`,
        `startParam: ${state.launch.startParam ?? '—'}`,
        `perf: ${state.launch.perfClass ?? '—'}`,
        `экран: ${v.width}×${v.height} @${v.dpr}`,
        `safe: ${v.safe.top}/${v.safe.right}/${v.safe.bottom}/${v.safe.left}`,
        `хранилища: ${platform.stores().map((s) => s.name).join(', ')}`,
        `старт: ${ms} мс`,
      ],
      v,
    );
  render(platform.viewport(render));
  platform.lifecycle(
    () => console.info('pause'),
    () => console.info('resume'),
  );
}

void main();
