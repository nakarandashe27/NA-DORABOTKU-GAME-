// Буфер ячеек — единственное, что ядро/приложение отдают рендеру. Один буфер → одинаковый вывод в обоих бэкендах.

/** Набор глифов атласа. Символ вне набора рисуется как '?'. Валидатор контента (этап 9) проверяет покрытие. */
export const GLYPHS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
  'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя' +
  '─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬░▒▓█▀▄▌▐■□▪·•°±×÷²³№«»—–…←↑→↓∞';

const INDEX = new Map([...GLYPHS].map((ch, i) => [ch, i]));
const UNKNOWN = INDEX.get('?') ?? 0;

/** Палитра на 16 цветов; ячейка хранит индексы. */
export const PALETTE = [
  '#0b0d12', // 0 фон
  '#1a1f2b', // 1 тёмно-серый
  '#3a4252', // 2 серый
  '#6b7489', // 3 светло-серый
  '#c8d0c0', // 4 бумага/текст
  '#f2f5ec', // 5 белый
  '#1f4d2b', // 6 тёмно-зелёный
  '#3f8f4f', // 7 зелёный
  '#9fd29f', // 8 светло-зелёный
  '#2a4a7a', // 9 синий (чертёж)
  '#6fa8ff', // 10 голубой
  '#c06a1e', // 11 оранжевый (фонарь)
  '#ffb347', // 12 жёлтый
  '#a3262a', // 13 красный (штамп)
  '#ff5a5f', // 14 ярко-красный
  '#7a4fa0', // 15 фиолетовый (ИИ)
] as const;

export interface CellBuffer {
  cols: number;
  rows: number;
  glyph: Uint16Array;
  fg: Uint8Array;
  bg: Uint8Array;
}

export function createBuffer(cols: number, rows: number): CellBuffer {
  const n = cols * rows;
  return { cols, rows, glyph: new Uint16Array(n), fg: new Uint8Array(n).fill(4), bg: new Uint8Array(n) };
}

function glyphIndex(ch: string): number {
  return INDEX.get(ch) ?? UNKNOWN;
}

/** Пишет строку с (col, row); всё, что за краем буфера, отбрасывается. */
export function putText(buf: CellBuffer, col: number, row: number, text: string, fg = 4, bg?: number): void {
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
