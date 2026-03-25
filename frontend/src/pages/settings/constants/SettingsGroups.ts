import type { SettingGroup } from '../types/SettingGroup.ts';
import { faCreditCard, faDollarSign, faFileContract, faLanguage, faList, faShieldHalved, faUser } from '@fortawesome/free-solid-svg-icons';

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
  {
    categoryKey: 'LEGAL_DOCUMENTS',
    items: [
      {
        icon: faShieldHalved,
        titleKey: 'PRIVACY_POLICY',
        path: '/privacy-policy',
        external: true
      },
      {
        icon: faFileContract,
        titleKey: 'TERMS_OF_SERVICE',
        path: '/terms-of-service',
        external: true
      },
    ],
  },
];
