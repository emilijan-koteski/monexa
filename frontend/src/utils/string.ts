/** Truncate a string to a maximum length and append a suffix. */
export const truncateText = (text: string, maxLength: number, suffix = '...'): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}${suffix}` : text;
