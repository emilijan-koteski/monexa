import type { SettingItem } from './SettingItem.ts';

export interface SettingGroup {
  categoryKey: string;
  items: SettingItem[];
}
