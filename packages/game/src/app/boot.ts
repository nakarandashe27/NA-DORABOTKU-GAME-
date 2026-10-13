// Порядок старта — context/architecture/01-обзор/карта-системы.md#порядок-старта
import type { KeyValueStore, LaunchInfo, Platform } from '../platform/types';

export interface BootSteps<Save, Content> {
  loadSave(stores: KeyValueStore[]): Promise<Save>;
  loadContent(): Promise<Content>;
}

export interface Booted<Save, Content> {
  launch: LaunchInfo;
  save: Save;
  content: Content;
  scene: 'boot';
}

/** platform → save → content → scene. Каждый шаг ждёт предыдущий — без гонок. */
export async function boot<Save, Content>(
  platform: Platform,
  steps: BootSteps<Save, Content>,
): Promise<Booted<Save, Content>> {
  const launch = await platform.start();
  const save = await steps.loadSave(platform.stores());
  const content = await steps.loadContent();
  return { launch, save, content, scene: 'boot' };
}
