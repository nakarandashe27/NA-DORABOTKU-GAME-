import { describe, expect, it } from 'vitest';
import { nextAudioState as next, wantsResume } from './state';

describe('автомат звука', () => {
  it('locked → running только когда контекст ответил running', () => {
    expect(next('locked', { type: 'gesture' })).toBe('locked');
    expect(next('locked', { type: 'ctx', state: 'suspended' })).toBe('locked');
    expect(next('locked', { type: 'ctx', state: 'running' })).toBe('running');
  });

  it('свернули → suspended, вернулись → ждём жест', () => {
    const s = next('running', { type: 'pause' });
    expect(s).toBe('suspended');
    expect(wantsResume(s, { type: 'gesture' })).toBe(true);
    expect(next(s, { type: 'ctx', state: 'running' })).toBe('running');
  });

  it('iOS-прерывание (звонок) → interrupted → возврат по жесту', () => {
    const s = next('running', { type: 'ctx', state: 'interrupted' });
    expect(s).toBe('interrupted');
    expect(wantsResume(s, { type: 'gesture' })).toBe(true);
    expect(next(s, { type: 'ctx', state: 'running' })).toBe('running');
  });

  it('работающий звук не перезапускается жестом', () => {
    expect(wantsResume('running', { type: 'gesture' })).toBe(false);
  });

  it('пауза до разблокировки ничего не ломает', () => {
    expect(next('locked', { type: 'pause' })).toBe('locked');
  });
});
