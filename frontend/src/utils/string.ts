/**
 * Truncate a string to a maximum length and append a suffix
 * @param text - The string to truncate
 * @param maxLength - Maximum number of characters before truncating
 * @param suffix - String to append when truncated (default: '...')
 * @returns The original string if within limit, otherwise truncated with suffix
 */
export const truncateText = (text: string, maxLength: number, suffix = '...'): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}${suffix}` : text;
