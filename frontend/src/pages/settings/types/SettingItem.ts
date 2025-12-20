import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Setting } from '../../../types/models.ts';

export interface SettingItem {
  icon: IconDefinition;
  titleKey: string;
  path: string;
  showValue?: boolean;
  getValue?: (settings: Setting | undefined) => string | undefined;
}
