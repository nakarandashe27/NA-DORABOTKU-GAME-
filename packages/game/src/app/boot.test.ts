import { describe, expect, it } from 'vitest';
import { createFakePlatform, memoryStore } from '../platform/fake';
import { isTelegramLaunch, perfClassFromUserAgent, startParamFromSearch } from '../platform/detect';
import { boot } from './boot';

describe('порядок старта', () => {
  it('platform → save → content, каждый шаг после предыдущего', async () => {
    const order: string[] = [];
    const { platform } = createFakePlatform({ channel: 'telegram', startParam: 'sheet.stairs_01' });
    const started = platform.start;
    platform.start = async () => (order.push('platform'), started());

    const state = await boot(platform, {
      loadSave: async () => (order.push('save'), 'S'),
      loadContent: async () => (order.push('content'), 'C'),
    });

    expect(order).toEqual(['platform', 'save', 'content']);
    expect(state).toMatchObject({ save: 'S', content: 'C', scene: 'boot' });
    expect(state.launch.startParam).toBe('sheet.stairs_01');
  });

  it('сейв читается из хранилищ платформы', async () => {
    const { platform } = createFakePlatform({}, [memoryStore('local', new Map([['save', '{"v":1}']]))]);
    const state = await boot(platform, {
      loadSave: async (stores) => stores[0]?.get('save') ?? null,
      loadContent: async () => null,
    });
    expect(state.save).toBe('{"v":1}');
  });
});

describe('определение Telegram', () => {
  it('обычная ссылка — браузер, SDK не грузим', () => {
    expect(isTelegramLaunch('', '')).toBe(false);
    expect(isTelegramLaunch('#section', '?start=sheet.a')).toBe(false);
  });

  it('параметры запуска Telegram — Telegram', () => {
    expect(isTelegramLaunch('#tgWebAppData=query_id%3D1&tgWebAppVersion=8.0', '')).toBe(true);
    expect(isTelegramLaunch('', '?tgWebAppStartParam=sheet.a')).toBe(true);
  });

  it('startParam не теряется, если SDK Telegram не загрузился', () => {
    expect(startParamFromSearch('?tgWebAppStartParam=sheet.door_02')).toBe('sheet.door_02');
    expect(startParamFromSearch('?start=sheet.a')).toBe('sheet.a');
    expect(startParamFromSearch('')).toBeNull();
  });

  it('класс производительности Android из User-Agent', () => {
    // формат из core.telegram.org/bots/webapps
    const ua = 'Mozilla/5.0 (Linux; Android 14) Telegram-Android/11.3.3 (Google sdk_gphone64_arm64; Android 14; SDK 34; AVERAGE)';
    expect(perfClassFromUserAgent(ua)).toBe('average');
    expect(perfClassFromUserAgent('Mozilla/5.0 (iPhone)')).toBeNull();
  });
});
