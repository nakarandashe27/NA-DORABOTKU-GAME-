import { BG, createBuffer, putText, type CellBuffer } from '../render/cells';

// ponytail: лист-заглушка скелета для теста читаемости; настоящие листы приходят из контента на этапе 9.
const ART = String.raw`
┌──────────────────────────────────────────────────────────────────────────────┐
│  ЛИСТ 1 из ∞            ПЛАН ЛЕСТНИЦЫ НА ОТМ. +3.300            М 1:50       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ╔══════════════════════════════════╗        ┌──────────────┐               │
│   ║ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓    ║        │  ЛИФТ        │               │
│   ║ ─┬──┬──┬──┬──┬──┬──┬──┬──┬──┬─   ║        │   ┌──────┐   │               │
│   ║  │  │  │  │  │  │  │  │  │  │    ║        │   │  WC  │   │               │
│   ║ ─┴──┴──┴──┴──┴──┴──┴──┴──┴──┴─   ║        │   └──────┘   │               │
│   ║                                  ║        └──────────────┘               │
│   ║   ←── 10 ступеней 150×300 ───    ║                                       │
│   ╚════════════╗      ╔══════════════╝         Перила: Н=900                 │
│                ║  ДВЕРЬ                        Дверь: 900×2100               │
│                ╚══════╝                                                      │
│                                                                              │
│  Примечания: 1. Размеры в мм.  2. Отметки — от ±0.000.  3. Всё «как в Дубае». │
├────────────────────────────────────────┬─────────────────────────────────────┤
│  ГАП: ____________   Стажёр: ________   │  СТАДИЯ: Р     ЛИСТ: 1             │
└────────────────────────────────────────┴─────────────────────────────────────┘
`;

const BLUE = 0x2a4a7a;
const LIGHT = 0x6fa8ff;
const COLOR: Record<string, number> = { '▓': 0x3a4252, '║': LIGHT, '═': LIGHT, '╔': LIGHT, '╗': LIGHT, '╚': LIGHT, '╝': LIGHT };

export function stubSheet(): CellBuffer {
  const lines = ART.split('\n').filter((l) => l.length > 0);
  const cols = Math.max(...lines.map((l) => [...l].length)) + 4;
  const buf = createBuffer(cols, lines.length + 4);
  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => putText(buf, c + 2, r + 2, ch, COLOR[ch] ?? (ch === 'W' || ch === 'C' ? 0xff5a5f : BLUE)));
  });
  return buf;
}

/** Копирует окно src начиная с (col, row) в dst; за краем — пусто. */
export function blit(src: CellBuffer, dst: CellBuffer, col: number, row: number): void {
  dst.glyph.fill(0);
  dst.bg.fill(BG);
  for (let r = 0; r < dst.rows; r++) {
    const sr = row + r;
    if (sr < 0 || sr >= src.rows) continue;
    for (let c = 0; c < dst.cols; c++) {
      const sc = col + c;
      if (sc < 0 || sc >= src.cols) continue;
      const si = sr * src.cols + sc;
      const di = r * dst.cols + c;
      dst.glyph[di] = src.glyph[si] ?? 0;
      dst.fg[di] = src.fg[si] ?? 0;
      dst.bg[di] = src.bg[si] ?? BG;
    }
  }
}
