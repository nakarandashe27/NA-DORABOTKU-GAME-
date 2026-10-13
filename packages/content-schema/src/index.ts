// Общий пакет: сейв (здесь), позже — типы контента и валидатор (этап 9). Импортируется игрой и будущим сервером.
export { SAVE_VERSION, SaveTooNewError, checksum, mergeSaves, migrate, newSave } from './save';
export type { Save } from './save';
