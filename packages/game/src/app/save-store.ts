// Сейв поверх хранилищ платформы — context/architecture/02-ядро/способности/сохранить-прогресс.md
import { SaveTooNewError, checksum, mergeSaves, migrate, newSave, type Save } from '@nd/content-schema';
import type { KeyValueStore } from '../platform/types';

const KEY = 'save';

export interface Loaded {
  save: Save;
  /** Копии разных игроков — решает человек (единственный случай вопроса). */
  conflict?: [Save, Save];
  /** Сейв новее игры (откат сборки): читаем, но не перезаписываем. */
  readOnly: boolean;
}

export interface SaveDeps {
  newPlayerId(): string;
  newSeed(): number;
  log?(msg: string): void;
}

/** Читает все копии, мигрирует (с бэкапом исходника), сливает. Ничего не нашлось — новый сейв. */
export async function loadSave(stores: KeyValueStore[], deps: SaveDeps): Promise<Loaded> {
  const copies: Save[] = [];
  let readOnly = false;

  for (const store of stores) {
    let raw: string | null = null;
    try {
      raw = await store.get(KEY);
      if (raw === null) continue;
      const m = migrate(JSON.parse(raw));
      if (!m) throw new Error('битый сейв');
      if (m.from !== m.save.v) await store.set(`${KEY}.backup.v${m.from}`, raw);
      copies.push(m.save);
    } catch (err) {
      if (err instanceof SaveTooNewError) readOnly = true;
      deps.log?.(`сейв в «${store.name}» не прочитан: ${String(err)}`);
      // Бэкап битой копии, чтобы её можно было разобрать руками; слияние идёт без неё.
      if (raw !== null && !(err instanceof SaveTooNewError)) await store.set(`${KEY}.backup.broken`, raw).catch(() => {});
    }
  }

  const [first, ...rest] = copies;
  if (!first) return { save: newSave(deps.newPlayerId(), deps.newSeed()), readOnly };
  let save = first;
  for (const other of rest) {
    const r = mergeSaves(save, other);
    if ('conflict' in r) return { save, conflict: r.conflict, readOnly };
    save = r.save;
  }
  return { save, readOnly };
}

/** rev + 1 и запись во все хранилища; упавшее хранилище не мешает остальным. */
export async function writeSave(stores: KeyValueStore[], save: Save, log?: (msg: string) => void): Promise<Save> {
  const next = { ...save, rev: save.rev + 1 };
  const json = JSON.stringify(next);
  await Promise.all(
    stores.map((s) => s.set(KEY, json).catch((err: unknown) => log?.(`сейв в «${s.name}» не записан: ${String(err)}`))),
  );
  return next;
}

/** «Код сейва» — мост браузер ⇄ Telegram до шага 2: base64(JSON).контрольная-сумма. */
export function encodeSaveCode(save: Save): string {
  const json = JSON.stringify(save);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return `${b64}.${checksum(json)}`;
}

/** Неверный код → null; сейв игрока при этом не трогаем. */
export function decodeSaveCode(code: string): Save | null {
  const [b64, sum] = code.trim().split('.');
  if (!b64 || !sum) return null;
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    if (checksum(json) !== sum) return null;
    return migrate(JSON.parse(json))?.save ?? null;
  } catch {
    return null;
  }
}
