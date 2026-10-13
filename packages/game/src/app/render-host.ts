import { createCanvas2DRenderer } from '../render/canvas2d';
import type { CellBuffer } from '../render/cells';
import type { Renderer, RendererKind } from '../render/types';
import { createWebGL2Renderer } from '../render/webgl2';

export interface RenderHost {
  readonly kind: RendererKind;
  resize(pxW: number, pxH: number, cellW: number, cellH: number): void;
  draw(buf: CellBuffer, offX?: number, offY?: number): void;
}

/**
 * Держит текущий рендер. WebGL2 по умолчанию; Canvas2D — если WebGL2 нет, если просили ?renderer=canvas,
 * или если контекст потерян и не вернулся (холст с webgl-контекстом не отдаёт 2d — заменяем элемент).
 */
export function createRenderHost(canvas: HTMLCanvasElement, prefer: RendererKind): RenderHost {
  let size: [number, number, number, number] | null = null;
  let last: [CellBuffer, number, number] | null = null;

  const toCanvas2D = (): Renderer => {
    const fresh = canvas.cloneNode() as HTMLCanvasElement;
    canvas.replaceWith(fresh);
    canvas = fresh;
    const r = createCanvas2DRenderer(fresh);
    if (size) r.resize(...size);
    if (last) r.draw(...last);
    return r;
  };

  let current: Renderer =
    (prefer === 'webgl2' && createWebGL2Renderer(canvas, () => (current = toCanvas2D()))) ||
    createCanvas2DRenderer(canvas);

  return {
    get kind() {
      return current.kind;
    },
    resize(...args) {
      size = args;
      current.resize(...args);
    },
    draw(buf, offX = 0, offY = 0) {
      last = [buf, offX, offY];
      current.draw(buf, offX, offY);
    },
  };
}
