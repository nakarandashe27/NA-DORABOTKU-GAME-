import { createWebAudio } from '../audio/audio';
import { gameInfo } from '../core/version';
import { createViewport, pan, screenToCell, zoomAt, type Viewport } from '../layout/grid';
import { wrap } from '../layout/wrap';
import { createBuffer, putText } from '../render/cells';
import { createBrowserPlatform } from '../platform/browser';
import { isTelegramLaunch } from '../platform/detect';
import { createTelegramPlatform, loadTelegramSdk } from '../platform/telegram';
import type { Platform, ViewportInfo } from '../platform/types';
import { boot } from './boot';
import { createRenderHost } from './render-host';
import { loadSave, writeSave } from './save-store';
import { createOffice, drawOffice, stepOffice, tapOffice, type OfficeLabels } from './scenes/office';
import { blit, stubSheet } from './stub-sheet';

const BOT_LINK = import.meta.env.VITE_BOT_LINK ?? '';
const params = new URLSearchParams(location.search);
/** office — look-dev сцена (по умолчанию); sheet — лист-заглушка скелета. ?dev — строка статуса. */
const SCENE = params.get('scene') === 'sheet' ? 'sheet' : 'office';
const DEV = params.has('dev') || SCENE === 'sheet';

async function pickPlatform(): Promise<Platform> {
  if (!isTelegramLaunch(location.hash, location.search)) return createBrowserPlatform();
  const tg = await loadTelegramSdk();
  return tg ? createTelegramPlatform(tg, BOT_LINK) : createBrowserPlatform();
}

async function main(): Promise<void> {
  const debug = params.get('debug');
  if (debug) {
    const { runDebug } = await import('./debug');
    (window as unknown as { __debug: unknown }).__debug = await runDebug(debug);
    return;
  }

  const t0 = performance.now();
  const platform = await pickPlatform();
  const state = await boot(platform, {
    loadSave: (stores) =>
      loadSave(stores, {
        newPlayerId: () => `p_${crypto.randomUUID()}`,
        newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
        log: (m) => console.warn(m),
      }),
    loadContent: async () => stubSheet(),
  });
  const startMs = Math.round(performance.now() - t0);
  const sheet = state.content;

  const canvasEl = document.querySelector<HTMLCanvasElement>('#screen');
  if (!canvasEl) throw new Error('нет #screen');
  const host = createRenderHost(canvasEl, params.get('renderer') === 'canvas' ? 'canvas2d' : 'webgl2');

  let save = state.save.save;
  let status = `${gameInfo.title} · ${state.launch.channel} · старт ${startMs} мс`;
  // ponytail: пока механики нет, сейв пишется при сворачивании — проверка «сейв переживает сворачивание» (этап 6).
  const persist = async () => {
    if (state.save.readOnly) return;
    save = await writeSave(platform.stores(), save, (m) => console.warn(m));
    render();
  };
  let zoom = 0;
  // В офисе «лист» — это весь экран: камера не панится.
  const worldSize = (v: ViewportInfo) => (SCENE === 'office' ? [Math.ceil(v.width), Math.ceil(v.height)] : [sheet.cols, sheet.rows]);
  // Сцена мелкими символами (~115 колонок по ширине, как в референсе); на больших экранах клетка не мельче 3.2 и не крупнее 6 CSS-px.
  const officeCell = (v: ViewportInfo) => Math.min(6, Math.max(3.2, v.width / 115));
  let view: Viewport = createViewport(1, 1, 1, sheet.cols, sheet.rows);
  let office = createOffice(1, 1);
  const setSize = (v: ViewportInfo) => {
    const [wc, wr] = worldSize(v);
    view = createViewport(v.width, v.height, v.dpr, wc ?? 1, wr ?? 1, zoom, SCENE === 'office' ? officeCell(v) : undefined);
    if (SCENE === 'office') office = createOffice(view.cols, view.rows);
    host.resize(view.pxW, view.pxH, view.cellW, view.cellH);
    render();
  };

  const audio = createWebAudio(() => render());
  // Звук разблокируется только синхронно в click (iOS не засчитывает touchstart).
  window.addEventListener('click', () => {
    audio.unlock();
    audio.play('beep');
  });

  // HTML-слой подписей: ник над головой и реплика — всегда читаемые, независимо от мелкости сцены.
  const ui = document.querySelector<HTMLDivElement>('#ui');
  const nameEl = document.createElement('div');
  nameEl.className = 'label';
  nameEl.textContent = 'стажёр';
  const sayEl = document.createElement('div');
  sayEl.className = 'say';
  if (SCENE === 'office') ui?.append(nameEl, sayEl);
  function placeLabels(labels: OfficeLabels): void {
    const x = (labels.name.col * view.cellW) / view.dpr;
    const y = (labels.name.row * view.cellH) / view.dpr;
    nameEl.style.left = `${x}px`;
    nameEl.style.top = `${y}px`;
    sayEl.textContent = labels.say ? `«${labels.say}»` : '';
    sayEl.style.left = `${x}px`;
    sayEl.style.top = `${y - 16}px`;
  }

  let frame = createBuffer(0, 0);
  let frameMs = 0;
  function render(): void {
    const tStart = performance.now();
    const col0 = Math.floor(view.panX / view.cellW);
    const row0 = Math.floor(view.panY / view.cellH);
    if (frame.cols !== view.cols + 1 || frame.rows !== view.rows + 1) frame = createBuffer(view.cols + 1, view.rows + 1);
    if (SCENE === 'office') placeLabels(drawOffice(frame, office, clock));
    else blit(sheet, frame, col0, row0);
    if (!DEV) {
      host.draw(frame, view.panX - col0 * view.cellW, view.panY - row0 * view.cellH);
      frameMs = frameMs * 0.9 + (performance.now() - tStart) * 0.1;
      return;
    }
    // ponytail: строка статуса поверх листа — уходит, когда появится UI листа (этап 11).
    const sound = audio.state === 'running' ? 'звук' : 'звук выкл';
    const info = `${status} · ${host.kind} · ${sound} · сейв r${save.rev} · клетка ${view.cellW}×${view.cellH}px · ${view.cols}×${view.rows} · кадр ${frameMs.toFixed(1)} мс`;
    // Переносим по словам — на узком экране (iPhone) статус не обрезается.
    const lines = wrap(info, Math.max(8, view.cols - 2));
    lines.forEach((line, i) => putText(frame, 0, view.rows - lines.length + i, ` ${line}`.padEnd(frame.cols), 0x0b0d12, 0x9fd29f));
    host.draw(frame, view.panX - col0 * view.cellW, view.panY - row0 * view.cellH);
    frameMs = frameMs * 0.9 + (performance.now() - tStart) * 0.1;
  }

  // Пан пальцем/мышью; короткое касание без смещения > 8 px — тап по клетке.
  let drag: { x: number; y: number; moved: number } | null = null;
  const canvas = () => document.querySelector<HTMLCanvasElement>('#screen') ?? canvasEl;
  window.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY, moved: 0 }));
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY, moved: drag.moved + Math.abs(dx) + Math.abs(dy) };
    if (SCENE === 'sheet') {
      view = pan(view, dx, dy);
      render();
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (drag && drag.moved <= 8) {
      const r = canvas().getBoundingClientRect();
      const c = screenToCell(e.clientX - r.left, e.clientY - r.top, view);
      status = c ? `тап: ${c.col}:${c.row}` : 'тап мимо листа';
      if (c && SCENE === 'office') tapOffice(office, c.col, c.row, view.cols, view.rows);
      render();
    }
    drag = null;
  });
  window.addEventListener('dblclick', (e) => {
    zoom = (view.zoom + 1) % 3;
    view = zoomAt(view, zoom, e.clientX, e.clientY);
    host.resize(view.pxW, view.pxH, view.cellW, view.cellH);
    render();
  });

  // Анимация офиса: время только из накопленного dt (≤ 100 мс за кадр), пауза — когда приложение свернуто.
  let clock = 0;
  let last = 0;
  let paused = false;
  const tick = (now: number) => {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    clock += dt;
    stepOffice(office, dt, view.cols);
    render();
    if (!paused) requestAnimationFrame(tick);
  };

  platform.lifecycle(
    () => {
      paused = true;
      audio.pause();
      void persist();
    },
    () => {
      if (paused && SCENE === 'office') {
        paused = false;
        last = 0;
        requestAnimationFrame(tick);
      } else render();
    },
  );
  setSize(platform.viewport(setSize));
  if (SCENE === 'office') requestAnimationFrame(tick);
}

void main().catch((err: unknown) => {
  console.error(err);
  document.body.innerHTML = '';
  const p = document.createElement('pre');
  p.style.cssText = 'font:14px monospace;color:#c8d0c0;padding:24px;white-space:pre-wrap';
  p.textContent = `НА ДОРАБОТКУ: игра не запустилась.\nСборка ${__BUILD__}\n\n${String(err)}`;
  document.body.append(p);
});
