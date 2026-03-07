export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api/v1',
  LEGAL_COMPLIANCE_ENABLED: import.meta.env.VITE_LEGAL_COMPLIANCE_ENABLED !== 'false',
} as const;
