import type { PerfClass } from './types';

/**
 * Открыта ли игра внутри Telegram. Telegram кладёт параметры запуска в hash (tgWebAppData, tgWebAppVersion…)
 * и startapp-параметр в tgWebAppStartParam.
 * ponytail: эвристика по URL; если какой-то клиент перестанет их передавать — игра просто стартует как браузерная.
 */
export function isTelegramLaunch(hash: string, search: string): boolean {
  return /[#&?]?tgWebApp(Data|Version|Platform)=/.test(hash) || /[?&]tgWebAppStartParam=/.test(search);
}

const ANDROID_PERF = /Telegram-Android\/[^\s]+\s+\([^)]*;\s*(LOW|AVERAGE|HIGH)\)/i;

/** Класс производительности Android-клиента Telegram из User-Agent; только подсказка для качества. */
export function perfClassFromUserAgent(ua: string): PerfClass | null {
  const m = ANDROID_PERF.exec(ua);
  return m?.[1] ? (m[1].toLowerCase() as PerfClass) : null;
}

/** startParam из URL: `?start=` (браузерная ссылка) или `tgWebAppStartParam` (Telegram, даже если SDK не загрузился). */
export function startParamFromSearch(search: string): string | null {
  const q = new URLSearchParams(search);
  return q.get('start') ?? q.get('tgWebAppStartParam');
}
