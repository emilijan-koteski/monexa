/**
 * Format a numeric string with thousand separators (commas)
 * @param value - Raw numeric string (e.g., "1234567.89")
 * @returns Formatted string with commas (e.g., "1,234,567.89")
 */
export function formatAmount(value: string): string {
  if (!value) return '';
  const [integer, decimal] = value.split('.');
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
}

/**
 * Remove all comma separators from a formatted amount string
 * @param value - Formatted amount string (e.g., "1,234,567.89")
 * @returns Raw numeric string without commas (e.g., "1234567.89")
 */
export function stripCommas(value: string): string {
  return value.replace(/,/g, '');
}
