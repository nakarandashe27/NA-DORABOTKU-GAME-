import { describe, expect, it } from 'vitest';
import { ZOOM_STEPS, cellToScreen, createViewport, pan, screenToCell, zoomAt } from './grid';
import { wrap } from './wrap';

const DPRS = [1, 2, 2.75, 2.0000000596046448];

describe('сетка и координаты', () => {
  for (const dpr of DPRS) {
    for (let zoom = 0; zoom < ZOOM_STEPS.length; zoom++) {
      it(`DPR ${dpr}, зум ${zoom}: клетка — целые физические пиксели, тап по центру попадает в неё`, () => {
        let v = createViewport(360, 640, dpr, 120, 80, zoom);
        expect(Number.isInteger(v.cellW) && Number.isInteger(v.cellH)).toBe(true);
        v = pan(v, -137, -59);
        for (const c of [{ col: 0, row: 0 }, { col: 40, row: 20 }, { col: 119, row: 79 }]) {
          const p = cellToScreen(c, v);
          const onScreen = p.x >= 0 && p.y >= 0 && p.x * v.dpr < v.pxW && p.y * v.dpr < v.pxH;
          if (onScreen) expect(screenToCell(p.x, p.y, v)).toEqual(c);
        }
      });
    }
  }

  it('тап мимо листа — null', () => {
    const v = createViewport(360, 640, 2, 10, 10);
    expect(screenToCell(359, 639, v)).toBeNull();
    expect(screenToCell(-1, 5, v)).toBeNull();
  });

  it('пан не выходит за края листа', () => {
    const v = createViewport(360, 640, 2, 120, 80);
    expect(pan(v, 10_000, 10_000)).toMatchObject({ panX: 0, panY: 0 });
    const end = pan(v, -10_000, -10_000);
    expect(end.panX).toBe(120 * v.cellW - v.pxW);
    expect(end.panY).toBe(80 * v.cellH - v.pxH);
  });

  it('лист меньше экрана не панится', () => {
    expect(pan(createViewport(360, 640, 2, 5, 5), -500, -500)).toMatchObject({ panX: 0, panY: 0 });
  });

  it('зум держит клетку под пальцем', () => {
    const v = pan(createViewport(360, 640, 2.75, 200, 120), -300, -200);
    const before = screenToCell(180, 320, v);
    const after = screenToCell(180, 320, zoomAt(v, 2, 180, 320));
    expect(after).toEqual(before);
  });
});

describe('перенос слов', () => {
  it('по словам в ширину', () => {
    expect(wrap('Лестница без перил. Опять.', 12)).toEqual(['Лестница без', 'перил.', 'Опять.']);
  });

  it('длинное слово режется', () => {
    expect(wrap('Ааааааааааа', 4)).toEqual(['Аааа', 'аааа', 'ааа']);
  });

  it('абзацы сохраняются', () => {
    expect(wrap('А\nБ', 10)).toEqual(['А', 'Б']);
  });

  it('ни одна строка не длиннее ширины', () => {
    const text = 'Уважаемый коллега, санузел перенесён в шахту лифта. Экономия площади — 4,2 м².';
    for (const w of [8, 13, 21]) expect(wrap(text, w).every((l) => l.length <= w)).toBe(true);
  });
});
