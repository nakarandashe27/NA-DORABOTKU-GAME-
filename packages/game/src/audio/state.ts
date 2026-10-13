// Автомат состояний звука — context/architecture/04-потоки/триггеры.md
// locked: ещё не было жеста (браузеры, особенно iOS, не дают играть звук до него).
// running: играет. suspended: свернули приложение. interrupted: iOS прервал (звонок, Siri).
// Из suspended/interrupted выходим только по следующему жесту — resume без жеста на iOS ненадёжен.
export type AudioState = 'locked' | 'running' | 'suspended' | 'interrupted';

export type AudioEvent =
  | { type: 'gesture' }
  | { type: 'pause' }
  | { type: 'ctx'; state: string };

/** Нужно ли пытаться (воз)обновить AudioContext при этом событии. */
export function wantsResume(state: AudioState, e: AudioEvent): boolean {
  return e.type === 'gesture' && state !== 'running';
}

export function nextAudioState(state: AudioState, e: AudioEvent): AudioState {
  switch (e.type) {
    case 'gesture':
      return state; // сам жест ничего не меняет — меняет ответ контекста
    case 'pause':
      return state === 'running' ? 'suspended' : state;
    case 'ctx':
      if (e.state === 'running') return 'running';
      if (e.state === 'interrupted') return 'interrupted';
      if (e.state === 'suspended') return state === 'locked' ? 'locked' : 'suspended';
      return state;
  }
}
