/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_LEGAL_COMPLIANCE_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
