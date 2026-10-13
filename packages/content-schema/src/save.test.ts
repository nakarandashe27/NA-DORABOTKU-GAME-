import { describe, expect, it } from 'vitest';
import { SaveTooNewError, checksum, mergeSaves, migrate, newSave, type Save } from './save';

const base = (over: Partial<Save> = {}): Save => ({ ...newSave('p_1', 42), ...over });

/** Зафиксированный сейв v1 — при появлении v2 сюда добавится образец, и миграция v1→v2 обязана его поднять. */
const FIXTURE_V1 = {
  v: 1,
  playerId: 'p_fixture',
  rev: 3,
  seed: 7,
  skill: 2,
  rep: { 'character.gap': -1 },
  results: { 'sheet.stairs_01': { found: ['defect.stairs_01.rail'], stamp: 'approved', attempt: 1 } },
  flags: ['flag.ai_arrived'],
  at: { chapter: 'chapter.1', scene: 'office' },
};

describe('миграции', () => {
  it('образец v1 читается как актуальный сейв', () => {
    expect(migrate(JSON.parse(JSON.stringify(FIXTURE_V1)))).toEqual({ save: FIXTURE_V1, from: 1 });
  });

  it('битые данные — null, а не исключение', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('мусор')).toBeNull();
    expect(migrate({ v: 1, playerId: '' })).toBeNull();
    expect(migrate({ ...FIXTURE_V1, results: { x: { found: 'нет' } } })).toBeNull();
  });

  it('сейв новее игры не трогаем', () => {
    expect(() => migrate({ v: 99 })).toThrow(SaveTooNewError);
  });
});

describe('слияние копий', () => {
  it('пройденное не теряется, даже если одна копия старее', () => {
    const local = base({ rev: 5, skill: 3, results: { 'sheet.a': { found: ['d1'], stamp: 'approved', attempt: 1 } } });
    const cloud = base({ rev: 2, skill: 1, results: { 'sheet.b': { found: [], stamp: 'rejected', attempt: 1 } } });
    const r = mergeSaves(local, cloud);
    if (!('save' in r)) throw new Error('конфликт не ожидался');
    expect(Object.keys(r.save.results).sort()).toEqual(['sheet.a', 'sheet.b']);
    expect(r.save.skill).toBe(3);
    expect(r.save.rev).toBe(5);
  });

  it('по одному листу побеждает более поздняя попытка, а не более свежая копия', () => {
    const newer = base({ rev: 9, results: { 'sheet.a': { found: [], stamp: 'rejected', attempt: 1 } } });
    const older = base({ rev: 1, results: { 'sheet.a': { found: ['d1'], stamp: 'approved', attempt: 2 } } });
    const r = mergeSaves(newer, older);
    expect('save' in r && r.save.results['sheet.a']?.attempt).toBe(2);
  });

  it('флаги объединяются — событие не запустится второй раз', () => {
    const r = mergeSaves(base({ rev: 1, flags: ['flag.b'] }), base({ rev: 2, flags: ['flag.a'] }));
    expect('save' in r && r.save.flags).toEqual(['flag.a', 'flag.b']);
  });

  it('репутация и позиция — из копии с большим rev (могут падать)', () => {
    const r = mergeSaves(base({ rev: 1, rep: { gap: 3 } }), base({ rev: 4, rep: { gap: -2 } }));
    expect('save' in r && r.save.rep).toEqual({ gap: -2 });
  });

  it('слияние коммутативно и идемпотентно', () => {
    const a = base({ rev: 3, skill: 2, flags: ['f1'], results: { s: { found: ['x'], stamp: 'approved', attempt: 1 } } });
    const b = base({ rev: 7, skill: 1, flags: ['f2'] });
    const ab = mergeSaves(a, b);
    const ba = mergeSaves(b, a);
    expect(ab).toEqual(ba);
    if ('save' in ab) expect(mergeSaves(ab.save, ab.save)).toEqual(ab);
  });

  it('разные игроки — конфликт, решает человек', () => {
    expect(mergeSaves(base(), { ...base(), playerId: 'p_2' })).toHaveProperty('conflict');
  });
});

describe('контрольная сумма', () => {
  it('стабильна и чувствительна к изменению', () => {
    expect(checksum('abc')).toBe(checksum('abc'));
    expect(checksum('abc')).not.toBe(checksum('abd'));
    expect(checksum('')).toMatch(/^[0-9a-f]{8}$/);
  });
});
