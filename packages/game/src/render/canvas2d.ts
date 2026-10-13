import { buildAtlas, type Atlas } from './atlas';
import { PALETTE, type CellBuffer } from './cells';
import type { Renderer } from './types';

/** Второй бэкенд: тот же атлас, тонированный под каждый цвет палитры. Включается флагом ?renderer=canvas. */
export function createCanvas2DRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D недоступен');
  let atlas: Atlas | null = null;
  const tinted = new Map<number, HTMLCanvasElement>();

  const tint = (color: number): HTMLCanvasElement => {
    let t = tinted.get(color);
    if (!t && atlas) {
      t = document.createElement('canvas');
      t.width = atlas.canvas.width;
      t.height = atlas.canvas.height;
      const tc = t.getContext('2d');
      if (!tc) throw new Error('Canvas2D недоступен');
      tc.drawImage(atlas.canvas, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = PALETTE[color] ?? PALETTE[4];
      tc.fillRect(0, 0, t.width, t.height);
      tinted.set(color, t);
    }
    if (!t) throw new Error('Атлас не собран — вызови resize()');
    return t;
  };

  return {
    kind: 'canvas2d',
    resize(pxW, pxH, cellW, cellH) {
      canvas.width = pxW;
      canvas.height = pxH;
      if (!atlas || atlas.cellW !== cellW || atlas.cellH !== cellH) {
        atlas = buildAtlas(cellW, cellH);
        tinted.clear();
      }
    },
    draw(buf: CellBuffer, offX = 0, offY = 0) {
      if (!atlas) return;
      const { cellW: w, cellH: h, perRow } = atlas;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = PALETTE[0];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let row = 0; row < buf.rows; row++) {
        for (let col = 0; col < buf.cols; col++) {
          const i = row * buf.cols + col;
          const x = col * w - offX;
          const y = row * h - offY;
          const bg = buf.bg[i] ?? 0;
          if (bg !== 0) {
            ctx.fillStyle = PALETTE[bg] ?? PALETTE[0];
            ctx.fillRect(x, y, w, h);
          }
          const g = buf.glyph[i] ?? 0;
          if (g === 0) continue; // пробел
          ctx.drawImage(tint(buf.fg[i] ?? 4), (g % perRow) * w, Math.floor(g / perRow) * h, w, h, x, y, w, h);
        }
      }
    },
  };
}
