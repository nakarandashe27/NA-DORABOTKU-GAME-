import type { KeyValueStore, LaunchInfo, Platform, ViewportInfo } from './types';

export function memoryStore(name = 'memory', data = new Map<string, string>()): KeyValueStore {
  return {
    name,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
  };
}

/** Платформа для тестов: управляемый запуск и ручной вызов паузы/возврата. */
export function createFakePlatform(launch: Partial<LaunchInfo> = {}, stores = [memoryStore()]) {
  let pause = () => {};
  let resume = () => {};
  const view: ViewportInfo = { width: 360, height: 640, dpr: 2, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  const platform: Platform = {
    start: async () => ({ channel: 'browser', startParam: null, perfClass: null, ...launch }),
    lifecycle(onPause, onResume) {
      pause = onPause;
      resume = onResume;
    },
    stores: () => stores,
    share: async () => 'shared',
    viewport: () => view,
  };
  return { platform, pause: () => pause(), resume: () => resume() };
}
