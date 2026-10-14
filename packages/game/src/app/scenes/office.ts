// Look-dev офиса в духе референса (IMG_0054): сцена считается по клеткам как свет × материал,
// символ выбирается по яркости (плотность глифа) и по направлению штриха (травинки, рябь), всё живёт во времени.
// Сцена рисуется мелкими клетками (~110+ колонок на телефоне); текст — HTML-слоем поверх (см. main).
// Масштаб: S = cols / 55 — сколько мелких клеток на одну «дизайн-клетку»; формы и шумы считаются в дизайн-
// координатах (col / S), поэтому при любой плотности картинка та же, только детальнее.
// ponytail: монолит одной функцией — пока ищем вид. Когда вид утвердим, разнесём: состояние в core, слои в render.
import { BG, glyphIndex, type CellBuffer } from '../../render/cells';

const DESIGN_COLS = 55;

export interface OfficeState {
  /** Позиция стажёра (ноги) и цель ходьбы — в клетках экрана. */
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Сколько секунд идёт; для шага ног. */
  walk: number;
  say: string | null;
}

/** Где показать HTML-подписи (в клетках): ник над головой и реплику. */
export interface OfficeLabels {
  name: { col: number; row: number };
  say: string | null;
}

export function createOffice(cols: number, rows: number): OfficeState {
  return { x: cols * 0.45, y: rows * 0.74, tx: cols * 0.45, ty: rows * 0.74, walk: 0, say: 'Тапни — пойду туда.' };
}

/** Клетка — тап → цель. Тап по столу — подходит к стулу и говорит. */
export function tapOffice(s: OfficeState, col: number, row: number, cols: number, rows: number): void {
  const L = layout(cols, rows);
  if (col >= L.desk.x0 && col <= L.desk.x1 && row >= L.desk.y0 - 6 * L.S && row <= L.desk.y1 + 2 * L.S) {
    s.tx = (L.desk.x0 + L.desk.x1) / 2;
    s.ty = L.desk.y1 + 9 * L.S;
    s.say = 'Лист на столе. ГАП ждёт к утру.';
  } else if (row > L.wallH + L.planterH) {
    s.tx = col;
    s.ty = row;
    s.say = null;
  }
}

export function stepOffice(s: OfficeState, dt: number, cols: number): void {
  const S = cols / DESIGN_COLS;
  const dx = s.tx - s.x;
  const dy = (s.ty - s.y) * 1.8;
  const d = Math.hypot(dx, dy);
  if (d < 0.3 * S) {
    s.walk = 0;
    return;
  }
  const v = Math.min(d, 14 * S * dt);
  s.x += (dx / d) * v;
  s.y += (dy / d) * (v / 1.8);
  s.walk += dt;
}

// ── шум и цвет ────────────────────────────────────────────────────────────────

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

type RGB = [number, number, number];
const hexRgb = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const pack = (c: RGB) => {
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (k(c[0]) << 16) | (k(c[1]) << 8) | k(c[2]);
};
const BG_RGB = hexRgb(BG);
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

const RAMP = [...' .`\',:;-~=+*xo#%&@'].map(glyphIndex);
const SOFT = [...' ..,,::;;~'].map(glyphIndex);
const FIGURE = [...'.:-=+*#%&@'].map(glyphIndex);
const G = (ch: string) => glyphIndex(ch);

// ── планировка от размера экрана ────────────────────────────────────────────

function layout(cols: number, rows: number) {
  const S = cols / DESIGN_COLS;
  const wallH = Math.max(Math.round(6 * S), Math.round(rows * 0.22));
  const planterH = Math.max(Math.round(4 * S), Math.round(rows * 0.08));
  const dw = Math.max(Math.round(18 * S), Math.round(cols * 0.46));
  const dx0 = Math.round(cols * 0.12);
  const dy0 = wallH + Math.round(rows * 0.14);
  const desk = { x0: dx0, x1: dx0 + dw, y0: dy0, y1: dy0 + Math.max(Math.round(5 * S), Math.round(rows * 0.12)) };
  return {
    S,
    wallH,
    planterH,
    desk,
    win: [
      { x0: Math.round(cols * 0.08), x1: Math.round(cols * 0.36), y0: Math.round(2 * S), y1: wallH - Math.round(2 * S) },
      { x0: Math.round(cols * 0.5), x1: Math.round(cols * 0.78), y0: Math.round(2 * S), y1: wallH - Math.round(2 * S) },
    ] as const,
    monitor: {
      x0: desk.x0 + Math.round(3 * S),
      x1: desk.x0 + Math.round(dw * 0.45),
      y0: desk.y0 - Math.round(4 * S),
      y1: desk.y0 + Math.round(1 * S),
    },
    lamp: { x: desk.x1 - Math.round(4 * S), y: desk.y0 + Math.round(1 * S) },
    mug: { x: desk.x0 + Math.round(dw * 0.62), y: desk.y0 + Math.round(2 * S) },
    papers: {
      x0: desk.x0 + Math.round(dw * 0.5),
      x1: desk.x0 + Math.round(dw * 0.8),
      y0: desk.y0 + Math.round(3 * S),
      y1: desk.y1 - Math.round(1 * S),
    },
    plant: { x: Math.round(cols * 0.86), y: Math.round(rows * 0.88) },
    cooler: { x: Math.round(cols * 0.9), y: wallH + planterH },
    puddle: { x: Math.round(cols * 0.82), y: wallH + Math.round(rows * 0.22) },
  };
}

// ── кэш статики: всё, что не зависит от времени, считается один раз на размер экрана ─────────

interface Cache {
  cols: number;
  rows: number;
  n: Float32Array;
  tex: Float32Array;
  vign: Float32Array;
  /** Затухание каждого источника (без яркости и мерцания) + лунные полосы. */
  lamp: Float32Array;
  mon: Float32Array;
  cool: Float32Array;
  moon: Float32Array;
}
let cache: Cache | null = null;

type Light = { x: number; y: number; r: number; c: RGB; k: number };

function falloff(l: Light, x: number, y: number): number {
  const d = Math.hypot(x - l.x, (y - l.y) * 1.8) / l.r;
  return Math.max(0, 1 - d) ** 2;
}

function moonBeam(L: ReturnType<typeof layout>, rows: number, x: number, y: number): number {
  let f = 0;
  for (const w of L.win) {
    const cx = (w.x0 + w.x1) / 2 + (y - L.wallH) * 0.35;
    const half = (w.x1 - w.x0) / 2 + (y - L.wallH) * 0.12;
    if (y > L.wallH && Math.abs(x - cx) < half) f += 0.16 * Math.max(0, 1 - (y - L.wallH) / (rows * 0.6));
  }
  return f;
}

function getCache(cols: number, rows: number, L: ReturnType<typeof layout>, lights: Light[]): Cache {
  if (cache && cache.cols === cols && cache.rows === rows) return cache;
  const N = cols * rows;
  const c: Cache = {
    cols,
    rows,
    n: new Float32Array(N),
    tex: new Float32Array(N),
    vign: new Float32Array(N),
    lamp: new Float32Array(N),
    mon: new Float32Array(N),
    cool: new Float32Array(N),
    moon: new Float32Array(N),
  };
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      c.n[i] = hash(col, row);
      c.tex[i] = 0.55 + 0.45 * smooth((col / L.S) * 0.35, (row / L.S) * 0.6);
      c.vign[i] = 1 - 0.55 * Math.hypot((col / cols - 0.5) * 1.2, row / rows - 0.5) ** 2;
      c.lamp[i] = lights[0] ? falloff(lights[0], col, row) : 0;
      c.mon[i] = lights[1] ? falloff(lights[1], col, row) : 0;
      c.cool[i] = lights[2] ? falloff(lights[2], col, row) : 0;
      c.moon[i] = moonBeam(L, rows, col, row);
    }
  }
  cache = c;
  return c;
}

// ── сцена ────────────────────────────────────────────────────────────────────

export function drawOffice(buf: CellBuffer, s: OfficeState, t: number): OfficeLabels {
  const { cols, rows } = buf;
  const L = layout(cols, rows);
  const S = L.S;
  const flicker = 0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 7.3);
  const lights: Light[] = [
    { x: L.lamp.x, y: L.lamp.y, r: Math.max(16 * S, cols * 0.33), c: [1, 0.72, 0.35], k: 1.25 * flicker },
    { x: (L.monitor.x0 + L.monitor.x1) / 2, y: L.monitor.y1 + S, r: Math.max(10 * S, cols * 0.2), c: [0.35, 0.6, 1], k: 0.7 },
    { x: L.cooler.x, y: L.cooler.y + 2 * S, r: 8 * S, c: [0.4, 0.75, 1], k: 0.35 },
  ];
  const moonX = L.win[1].x0 + (L.win[1].x1 - L.win[1].x0) * 0.7;

  const put = (i: number, glyph: number, fg: RGB, bgK = 0.025) => {
    buf.glyph[i] = glyph;
    buf.fg[i] = pack(fg);
    buf.bg[i] = pack([BG_RGB[0] + fg[0] * bgK, BG_RGB[1] + fg[1] * bgK, BG_RGB[2] + fg[2] * bgK]);
  };

  // холодный ночной эмбиент + источники + лунные полосы из окон
  const mix = (lamp: number, mon: number, cool: number, moon: number): RGB => {
    const [a, m, c] = lights as [Light, Light, Light];
    const fa = lamp * a.k;
    const fm = mon * m.k;
    const fc = cool * c.k;
    return [
      0.11 + a.c[0] * fa + m.c[0] * fm + c.c[0] * fc + 0.45 * moon,
      0.12 + a.c[1] * fa + m.c[1] * fm + c.c[1] * fc + 0.55 * moon,
      0.18 + a.c[2] * fa + m.c[2] * fm + c.c[2] * fc + 0.9 * moon,
    ];
  };
  const lightAt = (x: number, y: number): RGB =>
    mix(lights[0] ? falloff(lights[0], x, y) : 0, lights[1] ? falloff(lights[1], x, y) : 0, lights[2] ? falloff(lights[2], x, y) : 0, moonBeam(L, rows, x, y));
  const C0 = getCache(cols, rows, L, lights);
  const litAt = (i: number): RGB => mix(C0.lamp[i] ?? 0, C0.mon[i] ?? 0, C0.cool[i] ?? 0, C0.moon[i] ?? 0);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const n = C0.n[i] ?? 0;
      // дизайн-координаты для шумов и волн
      const X = col / S;
      const Y = row / S;
      const vign = C0.vign[i] ?? 1;

      // ── стена и окна
      if (row < L.wallH) {
        const w = L.win.find((w) => col >= w.x0 && col <= w.x1 && row >= w.y0 && row <= w.y1);
        if (w) {
          const mid = Math.round((w.x0 + w.x1) / 2);
          const vert = col === w.x0 || col === w.x1 || col === mid;
          if (vert || row === w.y0 || row === w.y1) {
            put(i, G(vert ? '│' : '─'), [0.32, 0.36, 0.44], 0.02);
            continue;
          }
          // небо, луна, дождь по стеклу
          const sky = 0.05 + 0.1 * (1 - (row - w.y0) / (w.y1 - w.y0));
          const moon = Math.max(0, 1 - Math.hypot(col - moonX, (row - (w.y0 + 2 * S)) * 1.8) / (4.5 * S));
          const rain = hash(col, Math.floor(row - t * 14 * S + col * 0.5), 3) > 0.92;
          if (moon > 0.45 && w === L.win[1]) put(i, RAMP[Math.min(RAMP.length - 1, 11 + Math.round(moon * 6))] ?? 0, [0.9, 0.92, 0.85], 0.06);
          else if (rain) put(i, G('/'), mul([0.35, 0.5, 0.8], 0.6 + n * 0.4), 0.02);
          else put(i, SOFT[Math.floor(n * 4)] ?? 0, [sky * 1.2 + moon * 0.7, sky * 1.6 + moon * 0.7, sky * 3.2 + moon * 0.8], 0.04);
          continue;
        }
        // штукатурка: вертикальная фактура, к полу темнее, плинтус
        const shade = 0.12 + 0.08 * smooth(X * 0.4, Y * 0.15) - (row / L.wallH) * 0.04;
        if (row >= L.wallH - Math.max(1, Math.round(S * 0.6))) put(i, G('▄'), [0.13, 0.12, 0.13]);
        else put(i, n > 0.7 ? G(':') : n > 0.35 ? G('.') : 0, [shade * 0.9, shade, shade * 1.25], 0.02);
        continue;
      }

      // ── озеленение под окнами — «трава» референса: штрихи по ветру, оттенки, редкие цветы-светлячки
      if (row < L.wallH + L.planterH && col >= 2 * S && col < cols * 0.8) {
        const lp = litAt(i);
        if (row >= L.wallH + L.planterH - Math.max(1, Math.round(S * 0.6))) {
          put(i, G(hash(Math.floor(X), 0, 25) > 0.5 ? '▀' : '='), [0.28 + lp[0] * 0.3, 0.2 + lp[1] * 0.2, 0.15]);
          continue;
        }
        const depth = (row - L.wallH) / L.planterH;
        const wind = Math.sin(t * 1.6 + X * 0.35 + Y * 0.8) + 0.5 * Math.sin(t * 0.7 + X * 0.11);
        const blade = wind > 0.55 ? '/' : wind < -0.55 ? '\\' : hash(col, row, 21) > 0.4 ? '|' : wind > 0 ? '/' : '\\';
        const clump = smooth(X * 0.25 + t * 0.15, Y * 0.9);
        const tone = (0.25 + 0.75 * hash(col, row, 22)) * (0.45 + 0.75 * clump);
        const k = 1.1 + depth * 0.9;
        if (hash(col, row, 23) > 0.97) {
          const glow = 0.55 + 0.45 * Math.sin(t * 2.5 + col);
          put(i, G(hash(col, row, 24) > 0.5 ? 'o' : '*'), mul([0.9, 0.95, 0.85], glow));
        } else {
          put(i, G(blade), [0.05 * tone * k + lp[0] * 0.3, (0.12 + 0.55 * tone) * k * (0.55 + lp[1]), (0.06 + 0.12 * tone) * k + lp[2] * 0.2]);
        }
        continue;
      }

      // ── пол (ковролин) + свет
      const lit = litAt(i);
      const tex = C0.tex[i] ?? 1;
      let base: RGB = [0.42 * tex, 0.44 * tex, 0.5 * tex];
      let glyphs = RAMP;
      let strokes: number | null = null;

      // стол
      const D = L.desk;
      const onDesk = col >= D.x0 && col <= D.x1 && row >= D.y0 && row <= D.y1;
      if (onDesk) {
        const grain = smooth(X * 0.15, Y * 2.5);
        base = [0.62 * (0.7 + grain * 0.3), 0.42 * (0.7 + grain * 0.3), 0.26];
        glyphs = [...'.-----===='].map(G);
        if (row > D.y1 - Math.max(1, Math.round(S * 0.6))) {
          put(i, G('▀'), [0.25, 0.16, 0.1].map((v, k) => v * (0.5 + (lit[k] ?? 0))) as RGB, 0);
          continue;
        }
      }
      // ножки стола
      if (row > D.y1 && row <= D.y1 + 1.5 * S && (Math.abs(col - (D.x0 + S)) < 0.6 * S || Math.abs(col - (D.x1 - S)) < 0.6 * S)) {
        put(i, G('│'), [0.2, 0.15, 0.12]);
        continue;
      }

      // монитор: рамка, светящийся экран с «чертежом»
      const M = L.monitor;
      if (col >= M.x0 && col <= M.x1 && row >= M.y0 && row <= M.y1) {
        const edge = col === M.x0 || col === M.x1 || row === M.y0 || row >= M.y1 - Math.max(0, Math.round(S * 0.5) - 1);
        if (edge) put(i, G(row >= M.y1 - 1 && row !== M.y0 ? '▀' : '▓'), [0.09, 0.1, 0.13], 0);
        else {
          const scan = (Math.floor(t * 6) + Math.floor(Y)) % 7 === 0;
          const vline = (Math.floor(X) + Math.floor(t * 2)) % 9 === 0;
          const hline = Math.floor(Y) === Math.floor(M.y0 / S) + 2;
          const ch = vline ? '│' : hline ? '─' : hash(col, row, Math.floor(t * 3)) > 0.85 ? '·' : '.';
          put(i, G(ch), scan ? [0.75, 0.9, 1] : ch === '.' ? [0.1, 0.18, 0.34] : [0.35, 0.6, 1], 0.08);
        }
        continue;
      }

      // лампа: абажур и яркое ядро
      const lx = col - L.lamp.x;
      const ly = row - L.lamp.y;
      if (Math.abs(lx) <= 1.4 * S && ly >= -1.2 * S && ly < -0.2 * S) {
        put(i, G(Math.abs(lx) < 0.5 * S ? '@' : '▄'), [1, 0.85 * flicker, 0.5], 0.15);
        continue;
      }
      if (Math.abs(lx) < 0.5 && ly >= -0.2 * S && ly <= 1.2 * S) {
        put(i, G('│'), [0.4, 0.35, 0.3]);
        continue;
      }

      // кружка и пар
      const mx = col - L.mug.x;
      const my = row - L.mug.y;
      if (Math.abs(mx) <= 0.8 * S && my >= -0.5 * S && my <= 0.5 * S) {
        put(i, G(Math.abs(mx) > 0.5 * S ? (mx > 0 ? ')' : '(') : 'U'), [0.85, 0.85, 0.82]);
        continue;
      }
      if (my < -0.5 * S && my >= -6 * S) {
        const k = -my / S;
        const sx = L.mug.x + Math.sin(t * 2 + k * 0.9) * (k * 0.35 * S);
        if (Math.abs(col - sx) < 0.5 && hash(Math.floor(k * 2), Math.floor(t * 4), 5) > 0.2) {
          put(i, G(Math.floor(k * 2) % 2 ? '~' : '('), mul([0.7, 0.7, 0.72], 1 - k / 6.5), 0.02);
          continue;
        }
      }

      // стопка листов — «ГАП ждёт»
      const P = L.papers;
      if (col >= P.x0 && col <= P.x1 && row >= P.y0 && row <= P.y1) {
        const ink = hash(col, row, 7) > 0.6;
        put(i, G(ink ? '-' : '='), [0.95 * lit[0] + 0.2, 0.93 * lit[1] + 0.2, 0.85 * lit[2] + 0.2], 0.04);
        continue;
      }

      // кулер с водой: бутыль, пузыри, основание
      const C = L.cooler;
      const cx2 = col - C.x;
      const cy2 = row - C.y;
      if (Math.abs(cx2) <= 1.5 * S && cy2 >= 0 && cy2 <= 7 * S) {
        if (cy2 <= 3 * S) {
          const bubble = hash(col, Math.floor(row + t * 4 * S), 9) > 0.93;
          const edgeX = Math.abs(cx2) > 1.1 * S;
          put(i, G(bubble ? 'o' : edgeX ? (cx2 > 0 ? ')' : '(') : hash(col, row, 4) > 0.5 ? '~' : '='), bubble ? [0.8, 0.95, 1] : [0.25, 0.55, 0.9], 0.05);
        } else put(i, G(cy2 > 6.4 * S ? '▀' : Math.abs(cx2) > 1.1 * S ? '│' : '='), mul([0.55, 0.58, 0.62], 0.4 + lit[0]), 0.03);
        continue;
      }

      // лужа под кулером: концентрическая рябь — оммаж воде из референса
      const pdx = col - L.puddle.x;
      const pdy = (row - L.puddle.y) * 1.8;
      const pd = Math.hypot(pdx, pdy) / S;
      if (pd < 7) {
        const ring = Math.sin(pd * 1.6 - t * 3.2);
        const ang = Math.atan2(pdy, pdx);
        const side = Math.abs(Math.cos(ang)) > 0.75 ? (Math.cos(ang) > 0 ? ')' : '(') : Math.abs(Math.cos(ang)) > 0.35 ? (Math.cos(ang) * Math.sin(ang) > 0 ? '\\' : '/') : '~';
        const k = (1 - pd / 7) * 0.9;
        // отражение лунного света в воде
        const glint = hash(col, Math.floor(t * 2), 31) > 0.985;
        if (ring > 0.6) put(i, G(side), [0.35 * k + 0.08, 0.6 * k + 0.1, 0.95 * k + 0.15], 0.03);
        else put(i, G(glint ? '*' : ring > 0 ? '~' : '.'), glint ? [0.8, 0.85, 0.9] : [0.08, 0.15, 0.28], 0.02);
        continue;
      }

      // растение в кадке: травинки качаются, символ — по наклону (как трава в референсе)
      const Pl = L.plant;
      const ldx = (col - Pl.x) / S;
      const ldy = ((Pl.y - row) * 1.8) / S;
      if (ldy >= -1.5 && ldy < 2.5 && Math.abs(ldx) <= 2.6 - Math.max(0, -ldy)) {
        put(i, G(ldy < 0.3 ? '▓' : '▄'), mul([0.45, 0.25, 0.15], 0.6 + lit[0] * 0.8), 0.04);
        continue;
      }
      if (ldy >= 2.5 && ldy < 18 && Math.abs(ldx) < 1 + ldy * 0.5 && hash(col, row, 11) > 0.2) {
        const sway = Math.sin(t * 1.4 + ldy * 0.25 + X * 0.15) * 0.6 + ldx * 0.13;
        strokes = G(sway > 0.35 ? '/' : sway < -0.35 ? '\\' : '|');
        const tone = 0.5 + 0.5 * hash(col, row, 12);
        base = [0.12 * tone, 0.55 * tone + 0.15 * (ldy / 18), 0.22 * tone];
      }

      // светлячки-пылинки в свете лампы
      const mote = hash(col, Math.floor(row + t * 0.8 * S), 13);
      const inLamp = Math.hypot(col - L.lamp.x, (row - L.lamp.y) * 1.8) < (lights[0]?.r ?? 1) * 0.6;
      if (inLamp && mote > 0.996 && !onDesk) {
        put(i, G(mote > 0.998 ? '*' : '·'), [1, 0.9, 0.6], 0.03);
        continue;
      }

      // итог: материал × свет, символ по яркости
      const c: RGB = [base[0] * lit[0] * 2.2 * vign, base[1] * lit[1] * 2.2 * vign, base[2] * lit[2] * 2.2 * vign];
      const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      if (strokes !== null) {
        put(i, strokes, mul(c, 1.8), 0.02);
        continue;
      }
      const idx = Math.min(glyphs.length - 1, Math.max(1, Math.floor(lum * glyphs.length * 1.6 + (n - 0.5) * 2.5)));
      put(i, glyphs[idx] ?? 0, [c[0] * 1.7 + 0.025, c[1] * 1.7 + 0.03, c[2] * 1.7 + 0.045]);
    }
  }

  return drawIntern(buf, s, t, S, lightAt);
}

/**
 * Стажёр — процедурная фигура (голова, волосы, торс, руки, ноги), объём от света:
 * символ по яркости из плотного ряда, правый бок (к лампе) светлее. Как фигура в референсе.
 */
function drawIntern(buf: CellBuffer, s: OfficeState, t: number, S: number, lightAt: (x: number, y: number) => RGB): OfficeLabels {
  const { cols, rows } = buf;
  const l = lightAt(s.x, s.y);
  const walking = s.walk > 0;
  const phase = walking ? Math.sin(t * 9) : 0;
  const bob = walking ? Math.abs(Math.sin(t * 9)) * 0.3 : Math.sin(t * 1.5) * 0.08; // дыхание на месте

  // Габарит в дизайн-клетках: ширина ±3.5, высота 0..-13 (вверх). Y по вертикали — в «квадратных» единицах (×1.8).
  const x0 = Math.floor(s.x - 4 * S);
  const x1 = Math.ceil(s.x + 4 * S);
  const y0 = Math.floor(s.y - (14 * S) / 1.8);
  const y1 = Math.ceil(s.y + S);

  for (let row = Math.max(0, y0); row <= Math.min(rows - 1, y1); row++) {
    for (let col = Math.max(0, x0); col <= Math.min(cols - 1, x1); col++) {
      const u = (col - s.x) / S; // по горизонтали
      const v = ((s.y - row) * 1.8) / S - bob; // вверх от ступней
      let mat: RGB | null = null;
      let nx = u / 3; // псевдонормаль: -1 левый край, +1 правый

      const legL = Math.abs(u + 0.9 - phase * 0.6 * (v < 4 ? (4 - v) / 4 : 0)) < 0.8 && v >= 0 && v < 4.2;
      const legR = Math.abs(u - 0.9 + phase * 0.6 * (v < 4 ? (4 - v) / 4 : 0)) < 0.8 && v >= 0 && v < 4.2;
      const torso = Math.abs(u) < 2.4 - Math.max(0, v - 8.5) * 0.6 && v >= 4 && v < 9.5;
      const armL = Math.abs(u + 2.9 + phase * 0.4 * ((9 - v) / 4)) < 0.6 && v >= 5 && v < 9;
      const armR = Math.abs(u - 2.9 - phase * 0.4 * ((9 - v) / 4)) < 0.6 && v >= 5 && v < 9;
      const hd = Math.hypot(u / 1.7, (v - 11.4) / 1.9);
      const head = hd < 1;

      if (head) {
        mat = v > 11.7 || (hd > 0.75 && v > 11) ? [0.2, 0.14, 0.1] : [0.92, 0.74, 0.6]; // волосы / лицо
        nx = u / 1.7;
      } else if (torso) mat = [0.8, 0.84, 0.92]; // рубашка
      else if (armL || armR) {
        mat = v < 5.6 ? [0.92, 0.74, 0.6] : [0.72, 0.76, 0.86]; // кисть / рукав
        nx = armR ? 0.9 : -0.9;
      } else if (legL || legR) mat = v < 0.7 ? [0.12, 0.1, 0.1] : [0.22, 0.26, 0.38]; // ботинки / брюки

      if (!mat) {
        // тень на полу
        const sh = Math.hypot(u / 3.4, (v + 0.2) / 0.9);
        if (sh < 1 && v < 0.6) {
          const i = row * cols + col;
          buf.glyph[i] = G(sh < 0.6 ? ':' : '.');
          buf.fg[i] = pack([0.03, 0.03, 0.05]);
          buf.bg[i] = BG;
        }
        continue;
      }
      // Фигура — главный объект кадра: всегда плотные символы и заметный объём, даже в тени.
      const shade = Math.min(1.5, (l[0] * 0.5 + l[1] * 0.3 + l[2] * 0.2) * (1.1 + 0.5 * nx) + 0.75 - Math.abs(nx) * 0.2);
      const g = FIGURE[Math.max(4, Math.min(FIGURE.length - 1, Math.floor(shade * 7)))] ?? 0;
      const i = row * cols + col;
      buf.glyph[i] = g;
      buf.fg[i] = pack(mul(mat, shade));
      buf.bg[i] = pack([BG_RGB[0] + mat[0] * shade * 0.04, BG_RGB[1] + mat[1] * shade * 0.04, BG_RGB[2] + mat[2] * shade * 0.04]);
    }
  }

  return { name: { col: s.x, row: s.y - ((15 + bob) * S) / 1.8 }, say: s.say };
}
