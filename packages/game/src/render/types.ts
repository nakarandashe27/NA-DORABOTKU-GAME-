import type { CellBuffer } from './cells';

export type RendererKind = 'webgl2' | 'canvas2d';

/** Контракт рендера — context/architecture/01-обзор/карта-системы.md#интерфейсы */
export interface Renderer {
  readonly kind: RendererKind;
  /** Размер холста и клетки в физических пикселях; пересобирает атлас при смене клетки. */
  resize(pxW: number, pxH: number, cellW: number, cellH: number): void;
  /** Рисует буфер со сдвигом (offX, offY) физических пикселей — для плавного пана внутри клетки. */
  draw(buf: CellBuffer, offX?: number, offY?: number): void;
}
