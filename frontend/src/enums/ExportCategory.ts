export const ExportCategory = {
  PROFILE: 'EXPORT_PROFILE',
  RECORDS: 'EXPORT_RECORDS',
  CATEGORIES: 'EXPORT_CATEGORIES',
  PAYMENT_METHODS: 'EXPORT_PAYMENT_METHODS',
  PREFERENCES: 'EXPORT_PREFERENCES',
  CONSENT: 'EXPORT_CONSENT',
} as const;

export type ExportCategoryType = (typeof ExportCategory)[keyof typeof ExportCategory];

export const ALL_EXPORT_CATEGORIES: ExportCategoryType[] = Object.values(ExportCategory);
