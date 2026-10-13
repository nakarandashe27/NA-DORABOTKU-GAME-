import { startParamFromSearch } from './detect';
import type { KeyValueStore, Platform, ShareResult, ViewportInfo } from './types';

export function localStore(): KeyValueStore {
  return {
    name: 'local',
    async get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    async set(key, value) {
      localStorage.setItem(key, value);
    },
  };
}

export function readViewport(): ViewportInfo {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    safe: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

function gameUrl(startParam: string): string {
  const url = new URL(location.href);
  url.hash = '';
  url.search = `?start=${encodeURIComponent(startParam)}`;
  return url.toString();
}

export function createBrowserPlatform(): Platform {
  return {
    async start() {
      return { channel: 'browser', startParam: startParamFromSearch(location.search), perfClass: null };
    },
    lifecycle(onPause, onResume) {
      document.addEventListener('visibilitychange', () => (document.hidden ? onPause() : onResume()));
    },
    stores: () => [localStore()],
    async share(text, startParam): Promise<ShareResult> {
      const url = gameUrl(startParam);
      try {
        if (navigator.share) {
          await navigator.share({ text, url });
          return 'shared';
        }
        await navigator.clipboard.writeText(`${text} ${url}`);
        return 'copied';
      } catch {
        return 'failed';
      }
    },
    viewport(onChange) {
      window.addEventListener('resize', () => onChange(readViewport()));
      return readViewport();
    },
  };
}
