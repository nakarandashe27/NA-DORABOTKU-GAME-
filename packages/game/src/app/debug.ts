import { createCanvas2DRenderer } from '../render/canvas2d';
import type { Renderer } from '../render/types';
import { createWebGL2Renderer } from '../render/webgl2';
import { stubSheet } from './stub-sheet';

// Debug-сцены для e2e-тестов (?debug=…). В обычной игре не запускаются.

function pixels(r: Renderer, canvas: HTMLCanvasElement): Uint8ClampedArray {
  const sheet = stubSheet();
  r.resize(sheet.cols * 9, sheet.rows * 16, 9, 16);
  r.draw(sheet);
  // Копируем в 2d сразу после draw в той же задаче — webgl-буфер ещё не очищен.
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas2D недоступен');
  ctx.drawImage(canvas, 0, 0);
  return ctx.getImageData(0, 0, copy.width, copy.height).data;
}

/** Доля пикселей, отличающихся больше чем на tolerance по любому каналу. */
function diff(a: Uint8ClampedArray, b: Uint8ClampedArray, tolerance = 24): number {
  let bad = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      if (Math.abs((a[i + k] ?? 0) - (b[i + k] ?? 0)) > tolerance) {
        bad++;
        break;
      }
    }
  }
  return bad / (a.length / 4);
}

const nonEmpty = (p: Uint8ClampedArray) => p.some((v, i) => i % 4 !== 3 && v > 40);

export async function runDebug(mode: string): Promise<unknown> {
  const glCanvas = document.createElement('canvas');
  const cvCanvas = document.createElement('canvas');
  const gl = createWebGL2Renderer(glCanvas);
  if (!gl) return { error: 'webgl2 недоступен' };
  const cv = createCanvas2DRenderer(cvCanvas);

  if (mode === 'compare') {
    const a = pixels(gl, glCanvas);
    const b = pixels(cv, cvCanvas);
    return { diff: diff(a, b), nonEmpty: nonEmpty(a) && nonEmpty(b) };
  }

  if (mode === 'contextloss') {
    const before = pixels(gl, glCanvas);
    const ext = (glCanvas.getContext('webgl2') as WebGL2RenderingContext).getExtension('WEBGL_lose_context');
    if (!ext) return { error: 'нет WEBGL_lose_context' };
    const restored = new Promise((res) => glCanvas.addEventListener('webglcontextrestored', res, { once: true }));
    ext.loseContext();
    await new Promise((res) => setTimeout(res, 50));
    ext.restoreContext();
    await restored;
    await new Promise((res) => setTimeout(res, 0));
    const after = pixels(gl, glCanvas);
    return { diff: diff(before, after), nonEmpty: nonEmpty(after) };
  }
  return { error: `неизвестный режим ${mode}` };
}
