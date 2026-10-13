// Только методы, сверенные с https://core.telegram.org/bots/webapps (2026-10-13).
import { localStore, readViewport } from './browser';
import { perfClassFromUserAgent, startParamFromSearch } from './detect';
import type { Insets, KeyValueStore, Platform, ViewportInfo } from './types';

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
/** activated/deactivated и safeAreaInset — Bot API 8.0. Ниже работаем без этих событий. */
const LIFECYCLE_VERSION = '8.0';

interface TgCloudStorage {
  getItem(key: string, cb: (err: unknown, value?: string) => void): void;
  setItem(key: string, value: string, cb?: (err: unknown, ok?: boolean) => void): void;
}

export interface TgWebApp {
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  isVersionAtLeast(v: string): boolean;
  onEvent(event: string, cb: () => void): void;
  openTelegramLink(url: string): void;
  initDataUnsafe: { start_param?: string };
  safeAreaInset?: Insets;
  CloudStorage?: TgCloudStorage;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

/** Грузит SDK; не дождались за timeoutMs или упало — null, игра стартует как браузерная. */
export function loadTelegramSdk(timeoutMs = 500): Promise<TgWebApp | null> {
  return new Promise((resolve) => {
    const done = (v: TgWebApp | null) => {
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.onload = () => done(window.Telegram?.WebApp ?? null);
    s.onerror = () => done(null);
    document.head.append(s);
  });
}

function cloudStore(cs: TgCloudStorage): KeyValueStore {
  return {
    name: 'cloud',
    get: (key) => new Promise((res) => cs.getItem(key, (err, v) => res(err ? null : (v ?? null)))),
    set: (key, value) =>
      new Promise((res, rej) => cs.setItem(key, value, (err) => (err ? rej(new Error(String(err))) : res()))),
  };
}

export function createTelegramPlatform(tg: TgWebApp, botLink: string): Platform {
  const lifecycleEvents = tg.isVersionAtLeast(LIFECYCLE_VERSION);
  const withSafe = (v: ViewportInfo): ViewportInfo => (tg.safeAreaInset ? { ...v, safe: { ...tg.safeAreaInset } } : v);

  return {
    async start() {
      tg.ready();
      tg.expand();
      tg.disableVerticalSwipes?.();
      return {
        channel: 'telegram',
        startParam: tg.initDataUnsafe.start_param ?? startParamFromSearch(location.search),
        perfClass: perfClassFromUserAgent(navigator.userAgent),
      };
    },
    lifecycle(onPause, onResume) {
      // visibilitychange приходит не во всех клиентах — дублируем событиями Telegram 8.0+; повтор безопасен.
      document.addEventListener('visibilitychange', () => (document.hidden ? onPause() : onResume()));
      if (lifecycleEvents) {
        tg.onEvent('deactivated', onPause);
        tg.onEvent('activated', onResume);
      }
    },
    stores: () => (tg.CloudStorage ? [localStore(), cloudStore(tg.CloudStorage)] : [localStore()]),
    async share(text, startParam) {
      // shareMessage требует сообщение, подготовленное сервером бота (Bot API 8.0) — сервера до шага 2 нет.
      const link = `${botLink}?startapp=${encodeURIComponent(startParam)}`;
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
      return 'shared';
    },
    viewport(onChange) {
      const emit = () => onChange(withSafe(readViewport()));
      tg.onEvent('viewportChanged', emit);
      if (lifecycleEvents) tg.onEvent('safeAreaChanged', emit);
      window.addEventListener('resize', emit);
      return withSafe(readViewport());
    },
  };
}
