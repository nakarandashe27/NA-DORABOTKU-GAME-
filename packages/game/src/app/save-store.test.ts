import { newSave } from '@nd/content-schema';
import { describe, expect, it } from 'vitest';
import { memoryStore } from '../platform/fake';
import type { KeyValueStore } from '../platform/types';
import { decodeSaveCode, encodeSaveCode, loadSave, writeSave } from './save-store';

const deps = { newPlayerId: () => 'p_new', newSeed: () => 1 };
const store = (name: string, save?: unknown) =>
  memoryStore(name, new Map(save === undefined ? [] : [['save', typeof save === 'string' ? save : JSON.stringify(save)]]));

describe('SaveStore', () => {
  it('пусто везде — новый сейв', async () => {
    const r = await loadSave([store('local'), store('cloud')], deps);
    expect(r.save.playerId).toBe('p_new');
    expect(r.conflict).toBeUndefined();
  });

  it('local и cloud сливаются: облако помнит лист, которого нет локально', async () => {
    const local = { ...newSave('p_1', 1), rev: 4, skill: 2 };
    const cloud = { ...newSave('p_1', 1), rev: 2, results: { 'sheet.a': { found: [], stamp: 'approved', attempt: 1 } } };
    const r = await loadSave([store('local', local), store('cloud', cloud)], deps);
    expect(r.save.skill).toBe(2);
    expect(r.save.results['sheet.a']).toBeDefined();
  });

  it('битая копия: бэкап и слияние без неё', async () => {
    const broken = store('local', '{не json');
    const good = store('cloud', { ...newSave('p_1', 1), skill: 5 });
    const r = await loadSave([broken, good], deps);
    expect(r.save.skill).toBe(5);
    expect(await broken.get('save.backup.broken')).toBe('{не json');
  });

  it('сейв новее игры — только чтение', async () => {
    const r = await loadSave([store('local', { v: 99 })], deps);
    expect(r.readOnly).toBe(true);
  });

  it('разные игроки — конфликт наружу', async () => {
    const r = await loadSave([store('local', newSave('p_1', 1)), store('cloud', newSave('p_2', 1))], deps);
    expect(r.conflict?.map((s) => s.playerId)).toEqual(['p_1', 'p_2']);
  });

  it('запись: rev+1 во все хранилища, падение одного не мешает другому', async () => {
    const ok = store('local');
    const failing: KeyValueStore = { name: 'cloud', get: async () => null, set: async () => Promise.reject(new Error('офлайн')) };
    const logs: string[] = [];
    const saved = await writeSave([ok, failing], newSave('p_1', 1), (m) => logs.push(m));
    expect(saved.rev).toBe(1);
    expect(JSON.parse((await ok.get('save')) ?? '{}').rev).toBe(1);
    expect(logs).toHaveLength(1);
  });

  it('сейв переживает «перезагрузку»: записали — прочитали то же', async () => {
    const s = store('local');
    const saved = await writeSave([s], { ...newSave('p_1', 9), flags: ['flag.ai_arrived'] });
    expect((await loadSave([s], deps)).save).toEqual(saved);
  });
});

describe('код сейва', () => {
  it('туда и обратно, с кириллицей', () => {
    const s = { ...newSave('p_1', 3), rep: { 'character.гап': 2 } };
    expect(decodeSaveCode(encodeSaveCode(s))).toEqual(s);
  });

  it('испорченный код — null', () => {
    const code = encodeSaveCode(newSave('p_1', 3));
    expect(decodeSaveCode(code.slice(0, -1) + (code.endsWith('0') ? '1' : '0'))).toBeNull();
    expect(decodeSaveCode('мусор')).toBeNull();
    expect(decodeSaveCode('')).toBeNull();
  });
});
