/**
 * Currency utility functions for formatting amounts with proper currency symbols
 */
export interface CurrencyConfig {
  symbol: string;
  position: 'before' | 'after';
}

const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  USD: { symbol: '$', position: 'before' },
  EUR: { symbol: '€', position: 'after' },
  MKD: { symbol: 'ден', position: 'after' },
};

/**
 * Get the currency symbol for a given currency code
 * @param currency - ISO currency code (e.g., 'USD', 'EUR', 'MKD')
 * @returns The currency symbol or the currency code if not found
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_CONFIGS[currency]?.symbol || currency;
}

/**
 * Format an amount with the appropriate currency symbol in the correct position
 * @param amount - The numeric amount to format
 * @param currency - ISO currency code (e.g., 'USD', 'EUR', 'MKD')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with currency symbol in the correct position
 */
export function formatCurrencyAmount(
  amount: number | string,
  currency: string,
  decimals: number = 2
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formattedAmount = numAmount.toFixed(decimals);

  const config = CURRENCY_CONFIGS[currency];

  if (!config) {
    return `${formattedAmount} ${currency}`;
  }

  if (config.position === 'before') {
    return `${config.symbol}${formattedAmount}`;
  } else {
    return `${formattedAmount} ${config.symbol}`;
  }
}

/**
 * Format an amount with currency and optional +/- prefix for income/expense
 * @param amount - The numeric amount to format
 * @param currency - ISO currency code (e.g., 'USD', 'EUR', 'MKD')
 * @param isExpense - Whether this is an expense (shows -) or income (shows +)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with sign and currency symbol
 */
export function formatRecordAmount(
  amount: number | string,
  currency: string,
  isExpense: boolean,
  decimals: number = 2
): string {
  const sign = isExpense ? '-' : '+';
  const formattedAmount = formatCurrencyAmount(amount, currency, decimals);
  return `${sign}${formattedAmount}`;
}
