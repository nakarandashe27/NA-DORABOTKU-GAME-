// Системы координат — context/architecture/01-обзор/карта-системы.md#системы-координат
// пиксели экрана (CSS) → физические пиксели → вьюпорт (окно на лист, пан/зум) → клетка листа.

/** Ступени зума: ширина клетки в CSS-пикселях. Минимум уточняется тестом читаемости (ворота скелета). */
export const ZOOM_STEPS = [7, 9, 12] as const;
/** Высота клетки к ширине — пропорция моноширинного шрифта. */
const CELL_ASPECT = 1.8;

export interface Cell {
  col: number;
  row: number;
}

export interface Viewport {
  /** Размер холста в физических пикселях. */
  pxW: number;
  pxH: number;
  dpr: number;
  zoom: number;
  /** Клетка — целое число физических пикселей: без швов и плывущих линий на дробном DPR. */
  cellW: number;
  cellH: number;
  /** Сколько клеток видно целиком. */
  cols: number;
  rows: number;
  /** Сдвиг окна по листу в физических пикселях (целые). */
  panX: number;
  panY: number;
  /** Размер листа в клетках — пан не выходит за его край. */
  sheetCols: number;
  sheetRows: number;
}

/** DPR из браузера бывает 2.0000000596 — округляем до сотых. */
function normalizeDpr(dpr: number): number {
  return Math.max(1, Math.round(dpr * 100) / 100);
}

function cellSize(zoom: number, dpr: number, cellCss?: number): { cellW: number; cellH: number } {
  const css = cellCss ?? ZOOM_STEPS[Math.min(Math.max(zoom, 0), ZOOM_STEPS.length - 1)] ?? ZOOM_STEPS[0];
  const cellW = Math.max(1, Math.round(css * dpr));
  return { cellW, cellH: Math.round(cellW * CELL_ASPECT) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

function clampPan(v: Viewport): Viewport {
  const maxX = v.sheetCols * v.cellW - v.pxW;
  const maxY = v.sheetRows * v.cellH - v.pxH;
  return { ...v, panX: Math.round(clamp(v.panX, 0, maxX)), panY: Math.round(clamp(v.panY, 0, maxY)) };
}

export function createViewport(
  cssW: number,
  cssH: number,
  rawDpr: number,
  sheetCols: number,
  sheetRows: number,
  zoom = 0,
  /** Своя ширина клетки в CSS-px вместо ступени зума — для сцены мелкими символами. */
  cellCss?: number,
): Viewport {
  const dpr = normalizeDpr(rawDpr);
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  const { cellW, cellH } = cellSize(zoom, dpr, cellCss);
  return clampPan({
    pxW,
    pxH,
    dpr,
    zoom,
    cellW,
    cellH,
    cols: Math.floor(pxW / cellW),
    rows: Math.floor(pxH / cellH),
    panX: 0,
    panY: 0,
    sheetCols,
    sheetRows,
  });
}

/** Тап (CSS-пиксели относительно холста) → клетка листа. null — мимо листа. */
export function screenToCell(x: number, y: number, v: Viewport): Cell | null {
  const col = Math.floor((x * v.dpr + v.panX) / v.cellW);
  const row = Math.floor((y * v.dpr + v.panY) / v.cellH);
  if (col < 0 || row < 0 || col >= v.sheetCols || row >= v.sheetRows) return null;
  return { col, row };
}

/** Центр клетки листа → CSS-пиксели холста (обратная к screenToCell; для подсветки и тестов). */
export function cellToScreen(c: Cell, v: Viewport): { x: number; y: number } {
  return {
    x: ((c.col + 0.5) * v.cellW - v.panX) / v.dpr,
    y: ((c.row + 0.5) * v.cellH - v.panY) / v.dpr,
  };
}

/** Перетаскивание пальцем на (dx, dy) CSS-пикселей. */
export function pan(v: Viewport, dx: number, dy: number): Viewport {
  return clampPan({ ...v, panX: v.panX - dx * v.dpr, panY: v.panY - dy * v.dpr });
}

/** Смена ступени зума с якорем: клетка под (x, y) остаётся под пальцем. */
export function zoomAt(v: Viewport, zoom: number, x: number, y: number): Viewport {
  const z = clamp(zoom, 0, ZOOM_STEPS.length - 1);
  if (z === v.zoom) return v;
  const { cellW, cellH } = cellSize(z, v.dpr);
  const fx = (x * v.dpr + v.panX) / v.cellW;
  const fy = (y * v.dpr + v.panY) / v.cellH;
  return clampPan({
    ...v,
    zoom: z,
    cellW,
    cellH,
    cols: Math.floor(v.pxW / cellW),
    rows: Math.floor(v.pxH / cellH),
    panX: fx * cellW - x * v.dpr,
    panY: fy * cellH - y * v.dpr,
  });
}
