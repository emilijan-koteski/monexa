/**
 * Format a date string or Date object to a locale-specific date string
 * @param date - ISO date string or Date object (e.g., "2026-02-05T00:00:00Z")
 * @returns Locale-formatted date string (e.g., "2/5/2026")
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString();
}
