// Public default for the published package; override with MONEXA_API_BASE_URL.
export const DEFAULT_API_BASE_URL = "https://api.monexa.world/api/v1";

export const API_BASE_URL =
  process.env.MONEXA_API_BASE_URL ?? DEFAULT_API_BASE_URL;
