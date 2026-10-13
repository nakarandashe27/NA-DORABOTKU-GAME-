import { GLYPHS } from './cells';

export interface Atlas {
  canvas: HTMLCanvasElement;
  /** Глифов в строке атласа. */
  perRow: number;
  cellW: number;
  cellH: number;
}

// ponytail: системный моноширинный шрифт через fillText; свой bitmap-шрифт с кириллицей — когда тест читаемости
// покажет, что системный на каком-то устройстве плох (вид будет разным на разных ОС).
const FONT_FAMILY = 'ui-monospace, "Cascadia Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

/** Белые глифы на прозрачном фоне, сетка cellW×cellH физических пикселей — по размеру клетки экрана. */
export function buildAtlas(cellW: number, cellH: number): Atlas {
  const chars = [...GLYPHS];
  const perRow = 32;
  const canvas = document.createElement('canvas');
  canvas.width = perRow * cellW;
  canvas.height = Math.ceil(chars.length / perRow) * cellH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D недоступен — атлас не собрать');

  const fontPx = Math.floor(Math.min(cellH * 0.8, cellW / 0.62));
  ctx.font = `${fontPx}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  chars.forEach((ch, i) => {
    const x = (i % perRow) * cellW;
    const y = Math.floor(i / perRow) * cellH;
    // Блочные символы — прямоугольниками: шрифты рисуют их с зазорами, а для ASCII-заливок нужен сплошной блок.
    if (ch === '█') ctx.fillRect(x, y, cellW, cellH);
    else if (ch === '▀') ctx.fillRect(x, y, cellW, Math.round(cellH / 2));
    else if (ch === '▄') ctx.fillRect(x, y + Math.round(cellH / 2), cellW, cellH - Math.round(cellH / 2));
    else {
      // Глиф строго внутри своей клетки: выносные элементы шрифта иначе залезают к соседям в атласе.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH);
      ctx.clip();
      ctx.fillText(ch, x + cellW / 2, y + cellH / 2);
      ctx.restore();
    }
  });
  return { canvas, perRow, cellW, cellH };
}
