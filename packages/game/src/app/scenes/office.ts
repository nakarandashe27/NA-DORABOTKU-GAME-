// Look-dev офиса в духе референса (IMG_0054): сцена считается по клеткам как свет + материал,
// символ выбирается по яркости (плотность глифа) и по направлению штриха (травинки, рябь), всё живёт во времени.
// ponytail: монолит одной функцией — пока ищем вид. Когда вид утвердим, разнесём: состояние в core, слои в render.
import { BG, glyphIndex, type CellBuffer } from '../../render/cells';

export interface OfficeState {
  /** Позиция стажёра и цель ходьбы — в клетках экрана. */
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Сколько секунд идёт; для шага ног. */
  walk: number;
  say: string | null;
}

export function createOffice(cols: number, rows: number): OfficeState {
  return { x: cols * 0.45, y: rows * 0.72, tx: cols * 0.45, ty: rows * 0.72, walk: 0, say: 'Тапни — пойду туда.' };
}

/** Клетка — тап → цель. Тап по столу — подходит к стулу и говорит. */
export function tapOffice(s: OfficeState, col: number, row: number, cols: number, rows: number): void {
  const L = layout(cols, rows);
  if (col >= L.desk.x0 && col <= L.desk.x1 && row >= L.desk.y0 && row <= L.desk.y1 + 2) {
    s.tx = (L.desk.x0 + L.desk.x1) / 2;
    s.ty = L.desk.y1 + 4;
    s.say = 'Лист на столе. ГАП ждёт к утру.';
  } else if (row > L.wallH + 1) {
    s.tx = col;
    s.ty = row;
    s.say = null;
  }
}

export function stepOffice(s: OfficeState, dt: number): void {
  const dx = s.tx - s.x;
  const dy = (s.ty - s.y) * 1.8;
  const d = Math.hypot(dx, dy);
  if (d < 0.3) {
    s.walk = 0;
    return;
  }
  const v = Math.min(d, 14 * dt);
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

const RAMP = [...' .`\',:;-~=+*xo#%&@'].map(glyphIndex);
const SOFT = [...' ..,,::;;~'].map(glyphIndex);
const G = (ch: string) => glyphIndex(ch);

// ── планировка от размера экрана ────────────────────────────────────────────

function layout(cols: number, rows: number) {
  const wallH = Math.max(6, Math.round(rows * 0.22));
  const dw = Math.max(18, Math.round(cols * 0.46));
  const dx0 = Math.round(cols * 0.12);
  const dy0 = wallH + Math.round(rows * 0.14);
  const desk = { x0: dx0, x1: dx0 + dw, y0: dy0, y1: dy0 + Math.max(5, Math.round(rows * 0.12)) };
  return {
    wallH,
    desk,
    win: [
      { x0: Math.round(cols * 0.08), x1: Math.round(cols * 0.36), y0: 2, y1: wallH - 2 },
      { x0: Math.round(cols * 0.5), x1: Math.round(cols * 0.78), y0: 2, y1: wallH - 2 },
    ] as const,
    monitor: { x0: desk.x0 + 3, x1: desk.x0 + Math.round(dw * 0.45), y0: desk.y0 - 4, y1: desk.y0 + 1 },
    lamp: { x: desk.x1 - 4, y: desk.y0 + 1 },
    mug: { x: desk.x0 + Math.round(dw * 0.62), y: desk.y0 + 2 },
    papers: { x0: desk.x0 + Math.round(dw * 0.5), x1: desk.x0 + Math.round(dw * 0.8), y0: desk.y0 + 3, y1: desk.y1 - 1 },
    plant: { x: Math.round(cols * 0.86), y: Math.round(rows * 0.86) },
    cooler: { x: Math.round(cols * 0.9), y: wallH + 3 },
    puddle: { x: Math.round(cols * 0.84), y: wallH + Math.round(rows * 0.2) },
  };
}

// ── сцена ────────────────────────────────────────────────────────────────────

export function drawOffice(buf: CellBuffer, s: OfficeState, t: number): void {
  const { cols, rows } = buf;
  const L = layout(cols, rows);
  const flicker = 0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 7.3);
  const lights: { x: number; y: number; r: number; c: RGB; k: number }[] = [
    { x: L.lamp.x, y: L.lamp.y, r: Math.max(16, cols * 0.33), c: [1, 0.72, 0.35], k: 1.25 * flicker },
    { x: (L.monitor.x0 + L.monitor.x1) / 2, y: L.monitor.y1 + 1, r: Math.max(10, cols * 0.2), c: [0.35, 0.6, 1], k: 0.7 },
    { x: L.cooler.x, y: L.cooler.y + 2, r: 7, c: [0.4, 0.75, 1], k: 0.35 },
  ];
  const moonX = L.win[1].x0 + (L.win[1].x1 - L.win[1].x0) * 0.7;

  const put = (i: number, glyph: number, fg: RGB, bgK = 0.025) => {
    buf.glyph[i] = glyph;
    buf.fg[i] = pack(fg);
    buf.bg[i] = pack([BG_RGB[0] + fg[0] * bgK, BG_RGB[1] + fg[1] * bgK, BG_RGB[2] + fg[2] * bgK]);
  };

  const lightAt = (x: number, y: number): RGB => {
    let r = 0.11;
    let g = 0.12;
    let b = 0.18; // холодный ночной эмбиент
    for (const l of lights) {
      const d = Math.hypot(x - l.x, (y - l.y) * 1.8) / l.r;
      const f = l.k * Math.max(0, 1 - d) ** 2;
      r += l.c[0] * f;
      g += l.c[1] * f;
      b += l.c[2] * f;
    }
    // лунный свет из окон падает на пол полосами
    for (const w of L.win) {
      const cx = (w.x0 + w.x1) / 2 + (y - L.wallH) * 0.35;
      const half = (w.x1 - w.x0) / 2 + (y - L.wallH) * 0.12;
      if (y > L.wallH && Math.abs(x - cx) < half) {
        const f = 0.16 * Math.max(0, 1 - (y - L.wallH) / (rows * 0.6));
        r += 0.45 * f;
        g += 0.55 * f;
        b += 0.9 * f;
      }
    }
    return [r, g, b];
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const n = hash(col, row);
      const vign = 1 - 0.55 * Math.hypot((col / cols - 0.5) * 1.2, row / rows - 0.5) ** 2;

      // ── стена и окна
      if (row < L.wallH) {
        const w = L.win.find((w) => col >= w.x0 && col <= w.x1 && row >= w.y0 && row <= w.y1);
        if (w) {
          const frame = col === w.x0 || col === w.x1 || row === w.y0 || row === w.y1 || col === Math.round((w.x0 + w.x1) / 2);
          if (frame) {
            put(i, G(col === w.x0 || col === w.x1 || col === Math.round((w.x0 + w.x1) / 2) ? '│' : '─'), [0.32, 0.36, 0.44], 0.02);
            continue;
          }
          // небо, луна, дождь по стеклу
          const sky = 0.05 + 0.1 * (1 - (row - w.y0) / (w.y1 - w.y0));
          const moon = Math.max(0, 1 - Math.hypot(col - moonX, (row - (w.y0 + 2)) * 1.8) / 4.5);
          const rain = hash(col, Math.floor(row - t * 14 + col * 0.5), 3) > 0.9;
          if (moon > 0.55 && w === L.win[1]) put(i, RAMP[Math.min(RAMP.length - 1, 12 + Math.round(moon * 5))] ?? 0, [0.9, 0.92, 0.85], 0.06);
          else if (rain) put(i, G('/'), [0.35, 0.5, 0.8].map((v) => v * (0.6 + n * 0.4)) as RGB, 0.02);
          else put(i, SOFT[Math.floor(n * 4)] ?? 0, [sky * 1.2 + moon * 0.7, sky * 1.6 + moon * 0.7, sky * 3.2 + moon * 0.8], 0.04);
          continue;
        }
        // штукатурка: вертикальная фактура, к полу темнее, плинтус
        const shade = 0.12 + 0.08 * smooth(col * 0.4, row * 0.15) - (row / L.wallH) * 0.04;
        if (row === L.wallH - 1) put(i, G('▄'), [0.13, 0.12, 0.13]);
        else put(i, n > 0.7 ? G(':') : n > 0.35 ? G('.') : 0, [shade * 0.9, shade, shade * 1.25], 0.02);
        continue;
      }

      // ── озеленение под окнами — «трава» референса: штрихи по ветру, оттенки, редкие цветы-светлячки
      const planterH = Math.max(4, Math.round(rows * 0.08));
      if (row >= L.wallH && row < L.wallH + planterH && col >= 2 && col < cols * 0.8) {
        const lp = lightAt(col, row);
        if (row === L.wallH + planterH - 1) {
          put(i, G(hash(col, 0, 25) > 0.5 ? '▀' : '='), [0.28 + lp[0] * 0.3, 0.2 + lp[1] * 0.2, 0.15]);
          continue;
        }
        const depth = (row - L.wallH) / planterH;
        const wind = Math.sin(t * 1.6 + col * 0.35 + row * 0.8) + 0.5 * Math.sin(t * 0.7 + col * 0.11);
        const blade = wind > 0.55 ? '/' : wind < -0.55 ? '\\' : hash(col, row, 21) > 0.4 ? '|' : wind > 0 ? '/' : '\\';
        const clump = smooth(col * 0.25 + t * 0.15, row * 0.9);
        const tone = (0.25 + 0.75 * hash(col, row, 22)) * (0.45 + 0.75 * clump);
        const k = 1.1 + depth * 0.9;
        if (hash(col, row, 23) > 0.955) {
          const glow = 0.55 + 0.45 * Math.sin(t * 2.5 + col);
          put(i, G(hash(col, row, 24) > 0.5 ? 'o' : '*'), [0.9 * glow, 0.95 * glow, 0.85 * glow]);
        } else {
          put(i, G(blade), [0.05 * tone * k + lp[0] * 0.3, (0.12 + 0.55 * tone) * k * (0.55 + lp[1]), (0.06 + 0.12 * tone) * k + lp[2] * 0.2]);
        }
        continue;
      }

      // ── пол (ковролин) + свет
      const lit = lightAt(col, row);
      const tex = 0.55 + 0.45 * smooth(col * 0.35, row * 0.6);
      let base: RGB = [0.42 * tex, 0.44 * tex, 0.5 * tex];
      let glyphs = RAMP;
      let strokes: number | null = null;

      // стол
      const D = L.desk;
      const onDesk = col >= D.x0 && col <= D.x1 && row >= D.y0 && row <= D.y1;
      if (onDesk) {
        const grain = smooth(col * 0.15, row * 2.5);
        base = [0.62 * (0.7 + grain * 0.3), 0.42 * (0.7 + grain * 0.3), 0.26];
        glyphs = [...'.-----===='].map(G);
        if (row === D.y1) {
          put(i, G('▀'), [0.25, 0.16, 0.1].map((v, k) => v * (0.5 + (lit[k] ?? 0))) as RGB, 0);
          continue;
        }
      }
      // ножки стола и стул
      if (row === D.y1 + 1 && (col === D.x0 + 1 || col === D.x1 - 1)) {
        put(i, G('│'), [0.2, 0.15, 0.12]);
        continue;
      }

      // монитор: рамка, светящийся экран с «чертежом»
      const M = L.monitor;
      if (col >= M.x0 && col <= M.x1 && row >= M.y0 && row <= M.y1) {
        const edge = col === M.x0 || col === M.x1 || row === M.y0 || row === M.y1;
        if (edge) put(i, G(row === M.y1 ? '▀' : '█'), [0.09, 0.1, 0.13], 0);
        else {
          const scan = (Math.floor(t * 6) + row) % 7 === 0;
          const line = (col + Math.floor(t * 2)) % 9 === 0 || row === M.y0 + 2;
          const ch = line ? ((col + Math.floor(t * 2)) % 9 === 0 ? '│' : '─') : hash(col, row, Math.floor(t * 3)) > 0.82 ? '·' : ' ';
          put(i, G(ch === ' ' ? '.' : ch), scan ? [0.75, 0.9, 1] : ch === ' ' ? [0.12, 0.22, 0.4] : [0.35, 0.6, 1], 0.08);
        }
        continue;
      }

      // лампа: абажур и яркое ядро
      if (Math.abs(col - L.lamp.x) <= 1 && row === L.lamp.y - 1) {
        put(i, G(col === L.lamp.x ? '@' : '▄'), [1, 0.85 * flicker, 0.5], 0.15);
        continue;
      }
      if (col === L.lamp.x && (row === L.lamp.y || row === L.lamp.y + 1)) {
        put(i, G('│'), [0.4, 0.35, 0.3]);
        continue;
      }

      // кружка и пар
      if (col === L.mug.x && row === L.mug.y) {
        put(i, G('u'), [0.85, 0.85, 0.82]);
        continue;
      }
      if (row < L.mug.y && row >= L.mug.y - 5) {
        const k = L.mug.y - row;
        const sx = L.mug.x + Math.round(Math.sin(t * 2 + k * 0.9) * (k * 0.35));
        if (col === sx && hash(k, Math.floor(t * 4), 5) > 0.25) {
          put(i, G(k % 2 ? '~' : '('), [0.7, 0.7, 0.72].map((v) => v * (1 - k / 6)) as RGB, 0.02);
          continue;
        }
      }

      // стопка листов — «ГАП ждёт»
      const P = L.papers;
      if (col >= P.x0 && col <= P.x1 && row >= P.y0 && row <= P.y1) {
        const ink = hash(col, row, 7) > 0.6;
        const p = lightAt(col, row);
        put(i, G(ink ? '-' : '='), [0.95 * p[0] + 0.2, 0.93 * p[1] + 0.2, 0.85 * p[2] + 0.2], 0.04);
        continue;
      }

      // кулер с водой: бутыль, пузыри, основание
      const C = L.cooler;
      if (Math.abs(col - C.x) <= 1 && row >= C.y && row <= C.y + 6) {
        if (row <= C.y + 2) {
          const bubble = row === C.y + 2 - (Math.floor(t * 3 + col) % 3) && hash(col, Math.floor(t * 3), 9) > 0.5;
          put(i, G(bubble ? 'o' : hash(col, row, 4) > 0.5 ? '#' : '%'), bubble ? [0.8, 0.95, 1] : [0.25, 0.55, 0.85], 0.05);
        } else put(i, G(row === C.y + 6 ? '▀' : '▓'), [0.55, 0.58, 0.62].map((v) => v * (0.4 + lit[0])) as RGB, 0.05);
        continue;
      }

      // лужа под кулером: концентрическая рябь — оммаж воде из референса
      const pd = Math.hypot(col - L.puddle.x, (row - L.puddle.y) * 1.8);
      if (pd < 6) {
        const ring = Math.sin(pd * 1.6 - t * 3.2);
        const ang = Math.atan2((row - L.puddle.y) * 1.8, col - L.puddle.x);
        const side = Math.abs(Math.cos(ang)) > 0.7 ? (Math.cos(ang) > 0 ? ')' : '(') : '~';
        const k = (1 - pd / 6) * 0.9;
        if (ring > 0.55) put(i, G(side), [0.35 * k + 0.08, 0.6 * k + 0.1, 0.95 * k + 0.15], 0.03);
        else put(i, G(ring > 0 ? '~' : '.'), [0.1, 0.18, 0.32], 0.02);
        continue;
      }

      // растение в кадке: травинки качаются, символ — по наклону (как трава в референсе)
      const Pl = L.plant;
      const ldx = col - Pl.x;
      const ldy = (Pl.y - row) * 1.8;
      if (ldy >= -1 && ldy < 2 && Math.abs(ldx) <= 2) {
        put(i, G(ldy < 0 ? '▀' : '▄'), [0.45, 0.25, 0.15], 0.1);
        continue;
      }
      if (ldy >= 2 && ldy < 16 && Math.abs(ldx) < 1 + ldy * 0.45 && hash(col, row, 11) > 0.25) {
        const sway = Math.sin(t * 1.4 + ldy * 0.25 + col * 0.15) * 0.6 + ldx * 0.12;
        strokes = G(sway > 0.35 ? '/' : sway < -0.35 ? '\\' : '|');
        const tone = 0.5 + 0.5 * hash(col, row, 12);
        base = [0.12 * tone, 0.55 * tone + 0.15 * (ldy / 16), 0.22 * tone];
      }

      // светлячки-пылинки в свете лампы
      const mote = hash(col, Math.floor(row + t * 0.8), 13);
      const inLamp = Math.hypot(col - L.lamp.x, (row - L.lamp.y) * 1.8) < (lights[0]?.r ?? 1) * 0.6;
      if (inLamp && mote > 0.993 && !onDesk) {
        put(i, G(mote > 0.997 ? '*' : '·'), [1, 0.9, 0.6], 0.03);
        continue;
      }

      // итог: материал × свет, символ по яркости
      const c: RGB = [base[0] * lit[0] * 2.2 * vign, base[1] * lit[1] * 2.2 * vign, base[2] * lit[2] * 2.2 * vign];
      const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      if (strokes !== null) {
        put(i, strokes, [c[0] * 1.8, c[1] * 1.8, c[2] * 1.8], 0.02);
        continue;
      }
      const idx = Math.min(glyphs.length - 1, Math.max(1, Math.floor(lum * glyphs.length * 1.6 + (n - 0.5) * 2.5)));
      put(i, glyphs[idx] ?? 0, [c[0] * 1.7 + 0.025, c[1] * 1.7 + 0.03, c[2] * 1.7 + 0.045]);
    }
  }

  drawIntern(buf, s, t, lightAt);
}

function drawIntern(buf: CellBuffer, s: OfficeState, t: number, lightAt: (x: number, y: number) => RGB): void {
  const { cols, rows } = buf;
  const set = (col: number, row: number, ch: string, c: RGB, bgK = 0.1) => {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return;
    const i = row * cols + col;
    buf.glyph[i] = glyphIndex(ch);
    buf.fg[i] = pack(c);
    buf.bg[i] = pack([BG_RGB[0] + c[0] * bgK, BG_RGB[1] + c[1] * bgK, BG_RGB[2] + c[2] * bgK]);
  };
  const cx = Math.round(s.x);
  const cy = Math.round(s.y);
  const l = lightAt(s.x, s.y);

  // Персонаж собран из плотных символов с объёмом от света, как фигура в референсе.
  // Маска: h — волосы, f — лицо, s — рубашка, b — брюки, L — ноги (шагают).
  const step = s.walk > 0 ? Math.floor(t * 8) % 2 : 0;
  const SPRITE = [' hhh ', ' fff ', 'sssss', 'sssss', ' bbb ', step ? ' L L ' : ' L  L'.slice(0, 5)];
  const MAT: Record<string, RGB> = { h: [0.18, 0.13, 0.1], f: [0.9, 0.72, 0.58], s: [0.78, 0.82, 0.9], b: [0.22, 0.25, 0.35], L: [0.2, 0.2, 0.25] };
  const DENSE = ['%', '#', '&', '@'];
  // тень на полу
  for (let dx = -3; dx <= 3; dx++) set(cx + dx, cy + 1, dx === -3 || dx === 3 ? '.' : ':', [0.04, 0.04, 0.06], 0);
  SPRITE.forEach((line, r) => {
    [...line].forEach((m, k) => {
      const mat = MAT[m];
      if (!mat) return;
      const dx = k - 2;
      const side = 0.75 + 0.18 * dx; // правый бок ближе к лампе — светлее
      const shade = Math.min(1.7, (l[0] + l[1] + l[2]) * 0.9 * side + 0.75);
      const ch = m === 'L' ? (step ? (dx < 0 ? '/' : '\\') : '|') : DENSE[Math.min(3, Math.max(0, Math.floor(shade * 2.4)))] ?? '#';
      set(cx + dx, cy - 5 + r, ch, [mat[0] * shade, mat[1] * shade, mat[2] * shade], 0.02);
    });
  });
  // ник над головой, как в референсе
  const name = 'стажёр';
  [...name].forEach((ch, k) => set(cx - 3 + k, cy - 7, ch, [0.8, 0.84, 0.88], 0));
  if (s.say) {
    const text = `«${s.say}»`;
    const x0 = Math.max(0, Math.min(cols - text.length, cx - Math.floor(text.length / 2)));
    [...text].forEach((ch, k) => set(x0 + k, cy - 9, ch, [0.95, 0.9, 0.7], 0.04));
  }
}
