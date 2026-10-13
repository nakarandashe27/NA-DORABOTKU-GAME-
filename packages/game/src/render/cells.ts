// Буфер ячеек — единственное, что приложение отдаёт рендеру. Один буфер → одинаковый вывод в обоих бэкендах.
// Цвет — полноцвет 0xRRGGBB: картинка «как в референсе» держится на плавных градиентах света, 16 цветов её убивают.

/** Набор глифов атласа (≤ 256 — индекс пакуется в 8 бит). Символ вне набора рисуется как '?'. */
export const GLYPHS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
  'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя' +
  '─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬░▒▓█▀▄▌▐■□▪·•°±×÷²³№«»—–…←↑→↓∞';

const INDEX = new Map([...GLYPHS].map((ch, i) => [ch, i]));
const UNKNOWN = INDEX.get('?') ?? 0;

/** Фон игры — им же очищается кадр. */
export const BG = 0x0b0d12;

export interface CellBuffer {
  cols: number;
  rows: number;
  glyph: Uint8Array;
  fg: Uint32Array;
  bg: Uint32Array;
}

export function createBuffer(cols: number, rows: number): CellBuffer {
  const n = cols * rows;
  return { cols, rows, glyph: new Uint8Array(n), fg: new Uint32Array(n), bg: new Uint32Array(n).fill(BG) };
}

export function glyphIndex(ch: string): number {
  return INDEX.get(ch) ?? UNKNOWN;
}

/** Пишет строку с (col, row); всё, что за краем буфера, отбрасывается. */
export function putText(buf: CellBuffer, col: number, row: number, text: string, fg = 0xc8d0c0, bg?: number): void {
  if (row < 0 || row >= buf.rows) return;
  let c = col;
  for (const ch of text) {
    if (c >= buf.cols) break;
    if (c >= 0) {
      const i = row * buf.cols + c;
      buf.glyph[i] = glyphIndex(ch);
      buf.fg[i] = fg;
      if (bg !== undefined) buf.bg[i] = bg;
    }
    c++;
  }
}
