// Контракт платформы — context/architecture/01-обзор/карта-системы.md#интерфейсы
type Channel = 'browser' | 'telegram';
export type PerfClass = 'low' | 'average' | 'high';

export interface LaunchInfo {
  channel: Channel;
  startParam: string | null;
  perfClass: PerfClass | null;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  dpr: number;
  safe: Insets;
}

/** Строковое хранилище ключ → значение; поверх него SaveStore (этап 6). */
export interface KeyValueStore {
  readonly name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export type ShareResult = 'shared' | 'copied' | 'failed';

export interface Platform {
  start(): Promise<LaunchInfo>;
  lifecycle(onPause: () => void, onResume: () => void): void;
  stores(): KeyValueStore[];
  share(text: string, startParam: string): Promise<ShareResult>;
  viewport(onChange: (v: ViewportInfo) => void): ViewportInfo;
}
