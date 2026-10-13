import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs-скрипт деплоя без типов
import { planKeep } from './keep-assets.mjs';

describe('хранение ассетов прошлых сборок', () => {
  it('первый деплой — ничего не копируем', () => {
    expect(planKeep([], ['index-a.js'])).toEqual({ toCopy: [], history: [['index-a.js']] });
  });

  it('держим 2 прошлые сборки + текущую, старше — уходят', () => {
    const history = [['index-c.js'], ['index-b.js'], ['index-a.js']];
    const r = planKeep(history, ['index-d.js']);
    expect(r.toCopy).toEqual(['index-c.js', 'index-b.js']);
    expect(r.history).toEqual([['index-d.js'], ['index-c.js'], ['index-b.js']]);
  });

  it('файл, который есть и в новой сборке, не копируется', () => {
    expect(planKeep([['debug-x.js', 'index-a.js']], ['debug-x.js', 'index-b.js']).toCopy).toEqual(['index-a.js']);
  });
});
