import type { SettingGroup } from '../types/SettingGroup.ts';
import { faCreditCard, faDollarSign, faLanguage, faList, faUser } from '@fortawesome/free-solid-svg-icons';

export const settingsGroups: SettingGroup[] = [
  {
    categoryKey: 'GENERAL',
    items: [{ icon: faUser, titleKey: 'ACCOUNT', path: '/settings/account' }],
  },
  {
    categoryKey: 'RECORDS',
    items: [
      { icon: faList, titleKey: 'CATEGORIES', path: '/settings/categories' },
      {
        icon: faCreditCard,
        titleKey: 'PAYMENT_TYPE',
        path: '/settings/payment-type',
      },
    ],
  },
  {
    categoryKey: 'APP_SETTINGS',
    items: [
      {
        icon: faDollarSign,
        titleKey: 'DISPLAY_CURRENCY',
        path: '/settings/display-currency',
        showValue: true,
        getValue: (settings) => settings?.currency,
      },
      {
        icon: faLanguage,
        titleKey: 'LANGUAGE',
        path: '/settings/language',
        showValue: true,
        getValue: (settings) => settings?.language,
      },
    ],
  },
];
