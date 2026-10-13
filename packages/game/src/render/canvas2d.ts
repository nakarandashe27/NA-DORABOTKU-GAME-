import { buildAtlas, type Atlas } from './atlas';
import { BG, type CellBuffer } from './cells';
import type { Renderer } from './types';

const hex = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;

/**
 * Запасной бэкенд (?renderer=canvas). Глиф берётся из того же атласа, что у WebGL2, и тонируется на холсте-
 * заготовке размером в клетку: так картинка совпадает с WebGL2 пиксель в пиксель при любом цвете.
 * ponytail: три операции на клетку — медленнее WebGL2; это фолбэк, не основной путь.
 */
export function createCanvas2DRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D недоступен');
  let atlas: Atlas | null = null;
  const cell = document.createElement('canvas');
  const cctx = cell.getContext('2d');
  if (!cctx) throw new Error('Canvas2D недоступен');

  return {
    kind: 'canvas2d',
    resize(pxW, pxH, cellW, cellH) {
      canvas.width = pxW;
      canvas.height = pxH;
      if (!atlas || atlas.cellW !== cellW || atlas.cellH !== cellH) {
        atlas = buildAtlas(cellW, cellH);
        cell.width = cellW;
        cell.height = cellH;
      }
    },
    draw(buf: CellBuffer, offX = 0, offY = 0) {
      if (!atlas) return;
      const { cellW: w, cellH: h, perRow } = atlas;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = hex(BG);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < buf.cols * buf.rows; i++) {
        const x = (i % buf.cols) * w - offX;
        const y = Math.floor(i / buf.cols) * h - offY;
        const bg = buf.bg[i] ?? BG;
        if (bg !== BG) {
          ctx.fillStyle = hex(bg);
          ctx.fillRect(x, y, w, h);
        }
        const g = buf.glyph[i] ?? 0;
        if (g === 0) continue; // пробел
        cctx.globalCompositeOperation = 'copy';
        cctx.drawImage(atlas.canvas, (g % perRow) * w, Math.floor(g / perRow) * h, w, h, 0, 0, w, h);
        cctx.globalCompositeOperation = 'source-in';
        cctx.fillStyle = hex(buf.fg[i] ?? 0);
        cctx.fillRect(0, 0, w, h);
        ctx.drawImage(cell, x, y);
      }
    },
  };
}
