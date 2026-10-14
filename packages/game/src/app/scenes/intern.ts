// Стажёр — процедурная фигура с очками и тубусом для чертежей.
// Заливка — плотные символы по свету (бок к лампе светлее), контур — штрихи по направлению края,
// как контуры в референсе. В луже под ногами — отражение: зеркально, синее, дрожит рябью.
import { BG, glyphIndex, type CellBuffer } from '../../render/cells';
import { glowBg, hash, mul, pack, type RGB } from './shade';

export interface InternState {
  /** Позиция ступней — в клетках экрана. */
  x: number;
  y: number;
  /** > 0 — идёт (секунды ходьбы). */
  walk: number;
}

type Part = 'hair' | 'skin' | 'glasses' | 'shirt' | 'collar' | 'strap' | 'tube' | 'belt' | 'pants' | 'shoes';

const PART_COLOR: Record<Part, RGB> = {
  hair: [0.2, 0.14, 0.1],
  skin: [0.92, 0.74, 0.6],
  glasses: [0.05, 0.05, 0.07],
  shirt: [0.82, 0.86, 0.93],
  collar: [1, 1, 1],
  strap: [0.3, 0.22, 0.18],
  tube: [0.55, 0.62, 0.7],
  belt: [0.12, 0.1, 0.09],
  pants: [0.3, 0.36, 0.56],
  shoes: [0.1, 0.08, 0.08],
};

/** Плотный ряд для заливки: чем светлее, тем «жирнее» символ. */
const FILL = [...'.:-=+*#%&@'];
const BACKSLASH = String.fromCharCode(92);

/** Рост фигуры в дизайн-единицах (u — вправо, v — вверх от ступней). */
export const FIGURE_HEIGHT = 14;
/** Фигура крупнее сцены: главный объект кадра, детали (очки, тубус) должны читаться. */
export const FIGURE_SCALE = 1.6;

/** Расстояние от точки до отрезка — руки, ноги, ремень, тубус. */
function seg(u: number, v: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const k = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - ax - dx * k, v - ay - dy * k);
}

/** Материал фигуры в точке (u, v) или null. phase — фаза шага −1..1. */
function figureAt(u: number, v: number, phase: number): Part | null {
  // голова: шапка волос чуть шире, очки, лицо
  const hx = u / 1.55;
  const hy = (v - 12.3) / 1.85;
  const hd = Math.hypot(hx, hy);
  if (hd < 1.12 && v > 12.7 && Math.abs(u) < 1.75) return 'hair';
  if (hd < 1) {
    if (v > 11.95 && v < 12.5 && (Math.abs(u - 0.62) < 0.42 || Math.abs(u + 0.62) < 0.42)) return 'glasses';
    if (hd > 0.82 && hy > -0.2) return 'hair';
    return 'skin';
  }
  // тубус за спиной, торчит над левым плечом
  if (seg(u, v, -2.1, 8.4, -3.0, 13.6) < 0.5) return 'tube';
  // шея
  if (Math.abs(u) < 0.45 && v >= 10.1 && v < 10.8) return 'skin';
  // руки: плечо → кисть, качаются в противофазе ногам
  for (const side of [-1, 1] as const) {
    const hand = side * 2.65 - side * phase * 0.55;
    if (seg(u, v, side * 2.25, 9.6, hand, 5.5) < 0.62) return v < 6.1 ? 'skin' : 'shirt';
  }
  // торс: трапеция (плечи шире талии), скруглённые плечи, воротник, ремень тубуса через грудь
  const half = 1.65 + Math.max(0, Math.min(1, (v - 5.4) / 4.2)) * 0.75 - (v > 9.6 ? (v - 9.6) * 1.1 : 0);
  if (v >= 5.4 && v < 10.2 && Math.abs(u) < half) {
    if (v > 9.4 && Math.abs(u) < 0.55) return 'collar';
    if (seg(u, v, -2.0, 9.4, 1.6, 5.7) < 0.3) return 'strap';
    return 'shirt';
  }
  if (v >= 5.0 && v < 5.4 && Math.abs(u) < 1.7) return 'belt';
  // ноги со шагом и ботинки (носок вперёд)
  for (const side of [-1, 1] as const) {
    const foot = side * 0.85 + side * phase * 0.7;
    if (v >= 0.6 && seg(u, v, side * 0.8, 5.1, foot, 0.6) < 0.72) return 'pants';
    if (v >= 0 && v < 0.8 && Math.abs(u - foot - 0.25) < 0.85) return 'shoes';
  }
  return null;
}

/** Штрих по направлению края: (nx, ny) — нормаль наружу, ny вверх. */
function edgeGlyph(nx: number, ny: number): string {
  if (nx === 0) return ny > 0 ? '^' : '_';
  if (ny === 0) return '|';
  return nx * ny > 0 ? '/' : BACKSLASH;
}

export interface Puddle {
  x: number;
  y: number;
  /** Радиус в дизайн-клетках. */
  r: number;
}

export function drawIntern(
  buf: CellBuffer,
  s: InternState,
  t: number,
  S: number,
  light: RGB,
  puddle: Puddle,
): void {
  const { cols, rows } = buf;
  const walking = s.walk > 0;
  const phase = walking ? Math.sin(t * 9) : 0;
  const bob = walking ? Math.abs(Math.sin(t * 9)) * 0.3 : Math.sin(t * 1.5) * 0.08; // на месте — дышит
  const F = S * FIGURE_SCALE; // клеток на дизайн-единицу фигуры
  const px = 1 / F; // одна клетка по горизонтали в дизайн-единицах
  const py = 1.8 / F; // одна клетка по вертикали
  const lum = light[0] * 0.5 + light[1] * 0.3 + light[2] * 0.2;

  const x0 = Math.max(0, Math.floor(s.x - 4.5 * F));
  const x1 = Math.min(cols - 1, Math.ceil(s.x + 4.5 * F));
  const y0 = Math.max(0, Math.floor(s.y - ((FIGURE_HEIGHT + 1) * F) / 1.8));
  const y1 = Math.min(rows - 1, Math.ceil(s.y + ((FIGURE_HEIGHT + 1) * F) / 1.8));

  for (let row = y0; row <= y1; row++) {
    for (let col = x0; col <= x1; col++) {
      const i = row * cols + col;
      const u = (col - s.x) / F;
      const vv = ((s.y - row) * 1.8) / F; // вверх от ступней

      if (vv >= -0.3) {
        const v = vv - bob;
        const part = figureAt(u, v, phase);
        if (part) {
          const base = PART_COLOR[part];
          const side = Math.max(-1, Math.min(1, u / 2.4));
          const shade = Math.min(1.5, lum * (1.1 + 0.5 * side) + 0.75 - Math.abs(side) * 0.2);
          const out = (du: number, dv: number) => figureAt(u + du, v + dv, phase) === null;
          const oL = out(-px, 0);
          const oR = out(px, 0);
          const oU = out(0, py);
          const oD = out(0, -py);
          const edge = oL || oR || oU || oD;
          let ch: string;
          if (part === 'glasses') ch = 'o';
          else if (part === 'collar') ch = 'v';
          else if (part === 'strap') ch = BACKSLASH;
          else if (edge && part !== 'skin') ch = edgeGlyph((oR ? 1 : 0) - (oL ? 1 : 0), (oU ? 1 : 0) - (oD ? 1 : 0));
          else ch = FILL[Math.max(4, Math.min(FILL.length - 1, Math.floor(shade * 7)))] ?? '#';
          const c = mul(base, edge ? shade * 0.8 : shade);
          buf.glyph[i] = glyphIndex(ch);
          buf.fg[i] = pack(c);
          buf.bg[i] = glowBg(c, 0.05);
          continue;
        }
        // мягкая тень на полу
        const sh = Math.hypot(u / 3.4, (vv + 0.2) / 0.9);
        if (sh < 1 && vv < 0.6) {
          buf.glyph[i] = glyphIndex(sh < 0.6 ? ':' : '.');
          buf.fg[i] = pack([0.03, 0.03, 0.05]);
          buf.bg[i] = BG;
        }
        continue;
      }

      // отражение в луже: зеркально вниз, дрожит рябью, синее и тусклое
      const pd = Math.hypot(col - puddle.x, (row - puddle.y) * 1.8) / S;
      if (pd >= puddle.r - 0.5) continue;
      const ripple = Math.sin(row * 0.9 + t * 4) * 0.35 + Math.sin(row * 0.37 - t * 2.3) * 0.2;
      const part = figureAt(u + ripple, -vv - bob, phase);
      if (!part) continue;
      const fade = Math.max(0, 1 + vv / (FIGURE_HEIGHT + 1)) * Math.sqrt(1 - pd / puddle.r);
      const base = PART_COLOR[part];
      buf.glyph[i] = glyphIndex(hash(col, Math.floor(t * 6), 41) > 0.85 ? '~' : FILL[4 + Math.floor(fade * 4)] ?? '+');
      buf.fg[i] = pack([base[0] * 0.3 * fade + 0.03, base[1] * 0.4 * fade + 0.06, base[2] * 0.65 * fade + 0.15 * fade]);
      buf.bg[i] = BG;
    }
  }
}
