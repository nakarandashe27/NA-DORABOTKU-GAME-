// Общие помощники сцен: детерминированный шум и упаковка цвета.
import { BG } from '../../render/cells';

export type RGB = [number, number, number];

export function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Сглаженный value-noise на целочисленной решётке. */
export function smooth(x: number, y: number): number {
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

const hexRgb = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export const pack = (c: RGB): number => {
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (k(c[0]) << 16) | (k(c[1]) << 8) | k(c[2]);
};

export const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

const BG_RGB = hexRgb(BG);

/** Фон клетки: почти чёрный с едва заметным отсветом цвета символа. */
export const glowBg = (c: RGB, k: number): number =>
  pack([BG_RGB[0] + c[0] * k, BG_RGB[1] + c[1] * k, BG_RGB[2] + c[2] * k]);
