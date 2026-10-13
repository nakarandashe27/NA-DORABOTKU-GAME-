/// <reference types="vite/client" />

/** Короткий хеш коммита сборки — на экране ошибки и в коде сейва. */
declare const __BUILD__: string;

interface ImportMetaEnv {
  readonly VITE_BOT_LINK?: string;
}
