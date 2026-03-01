export const CURRENT_YEAR = new Date().getFullYear();
export const CURRENT_MONTH = new Date().getMonth() + 1;
export const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - i);
