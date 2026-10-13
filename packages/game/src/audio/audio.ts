import { nextAudioState, wantsResume, type AudioEvent, type AudioState } from './state';

type Sfx = 'beep';

/** Контракт звука — context/architecture/01-обзор/карта-системы.md#интерфейсы. Игра полностью играбельна без звука. */
export interface GameAudio {
  readonly state: AudioState;
  /** Вызывать синхронно в обработчике click: только так iOS разрешает звук. */
  unlock(): void;
  pause(): void;
  play(sfx: Sfx): void;
}

type Ctx = AudioContext & { state: AudioContextState | 'interrupted' };

export function createWebAudio(onChange: (s: AudioState) => void = () => {}): GameAudio {
  let state: AudioState = 'locked';
  let ctx: Ctx | null = null;

  const dispatch = (e: AudioEvent) => {
    const next = nextAudioState(state, e);
    if (next !== state) {
      state = next;
      onChange(state);
    }
  };

  return {
    get state() {
      return state;
    },
    unlock() {
      if (!wantsResume(state, { type: 'gesture' })) return;
      try {
        if (!ctx) {
          ctx = new AudioContext() as Ctx;
          ctx.onstatechange = () => ctx && dispatch({ type: 'ctx', state: ctx.state });
        }
        const c = ctx;
        void c.resume().then(() => dispatch({ type: 'ctx', state: c.state }), () => {});
      } catch {
        // AudioContext недоступен — остаёмся в locked, игра без звука.
      }
    },
    pause() {
      dispatch({ type: 'pause' });
      void ctx?.suspend().catch(() => {});
    },
    play(sfx) {
      if (state !== 'running' || !ctx) return;
      // ponytail: один «пик» для скелета; процедурные SFX (штамп, плоттер, бормотание) — этап 15.
      if (sfx !== 'beep') return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    },
  };
}
