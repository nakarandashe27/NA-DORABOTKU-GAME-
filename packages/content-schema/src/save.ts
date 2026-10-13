// Формат сейва и правила слияния — context/architecture/03-данные/сущности.md (Кирпич 2).

interface SheetResult {
  found: string[];
  stamp: 'approved' | 'rejected';
  attempt: number;
}

interface SaveV1 {
  v: 1;
  playerId: string;
  rev: number;
  seed: number;
  skill: number;
  rep: Record<string, number>;
  results: Record<string, SheetResult>;
  flags: string[];
  at: { chapter: string; scene: string };
}

export type Save = SaveV1;
export const SAVE_VERSION = 1;

export function newSave(playerId: string, seed: number): Save {
  return {
    v: 1,
    playerId,
    rev: 0,
    seed,
    skill: 0,
    rep: {},
    results: {},
    flags: [],
    at: { chapter: 'chapter.1', scene: 'office' },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function isSheetResult(x: unknown): x is SheetResult {
  return (
    isObj(x) &&
    Array.isArray(x['found']) &&
    x['found'].every((f) => typeof f === 'string') &&
    (x['stamp'] === 'approved' || x['stamp'] === 'rejected') &&
    isNum(x['attempt'])
  );
}

function isSaveV1(x: unknown): x is SaveV1 {
  if (!isObj(x) || x['v'] !== 1) return false;
  const { playerId, rev, seed, skill, rep, results, flags, at } = x;
  return (
    typeof playerId === 'string' &&
    playerId.length > 0 &&
    isNum(rev) &&
    isNum(seed) &&
    isNum(skill) &&
    isObj(rep) &&
    Object.values(rep).every(isNum) &&
    isObj(results) &&
    Object.values(results).every(isSheetResult) &&
    Array.isArray(flags) &&
    flags.every((f) => typeof f === 'string') &&
    isObj(at) &&
    typeof at['chapter'] === 'string' &&
    typeof at['scene'] === 'string'
  );
}

export class SaveTooNewError extends Error {
  constructor(readonly version: number) {
    super(`Сейв версии ${version} новее игры (${SAVE_VERSION}) — не трогаем`);
  }
}

/** Миграции v(N) → v(N+1). Пусто, пока есть только v1; первая миграция добавится вместе с v2. */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {};

/**
 * Любые данные из хранилища → актуальный сейв.
 * Новее игры → SaveTooNewError (откат сборки: не перезаписываем). Битый → null.
 */
export function migrate(raw: unknown): { save: Save; from: number } | null {
  if (!isObj(raw) || !isNum(raw['v'])) return null;
  const from = raw['v'];
  if (from > SAVE_VERSION) throw new SaveTooNewError(from);
  let cur: Record<string, unknown> = raw;
  for (let v = from; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    cur = step(cur);
  }
  return isSaveV1(cur) ? { save: cur, from } : null;
}

export type MergeResult = { save: Save } | { conflict: [Save, Save] };

/**
 * Слияние двух копий одного игрока. Прогресс монотонный — ничего пройденного не теряется;
 * время устройства не участвует. Разные playerId — это разные игроки: решает человек.
 */
export function mergeSaves(a: Save, b: Save): MergeResult {
  if (a.playerId !== b.playerId) return { conflict: [a, b] };
  const [newer, older] = a.rev >= b.rev ? [a, b] : [b, a];

  const results: Record<string, SheetResult> = { ...older.results };
  for (const [id, r] of Object.entries(newer.results)) {
    const o = results[id];
    results[id] = !o || r.attempt >= o.attempt ? r : o;
  }

  return {
    save: {
      v: 1,
      playerId: newer.playerId,
      rev: newer.rev,
      seed: newer.seed,
      skill: Math.max(a.skill, b.skill),
      rep: { ...newer.rep },
      results,
      flags: [...new Set([...a.flags, ...b.flags])].sort(),
      at: { ...newer.at },
    },
  };
}

/** FNV-1a 32 бита — контрольная сумма «кода сейва», не криптография. */
export function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
