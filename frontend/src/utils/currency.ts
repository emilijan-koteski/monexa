import { formatAmount } from './amount';
import { Currency } from '../enums/Currency';

/**
 * Currency utility functions for formatting amounts with proper currency symbols
 */
export interface CurrencyConfig {
  symbol: string;
  position: 'before' | 'after';
  decimals?: number;
}

const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  [Currency.USD]: { symbol: '$', position: 'before' },
  [Currency.EUR]: { symbol: '€', position: 'after' },
  [Currency.MKD]: { symbol: 'ден', position: 'after' },
  [Currency.AUD]: { symbol: 'A$', position: 'before' },
  [Currency.CHF]: { symbol: 'CHF', position: 'before' },
  [Currency.GBP]: { symbol: '£', position: 'before' },
  [Currency.HUF]: { symbol: 'Ft', position: 'after', decimals: 0 },
  [Currency.RSD]: { symbol: 'дин', position: 'after' },
};

/**
 * Get the currency symbol for a given currency code
 * @param currency - ISO currency code (e.g., 'USD', 'EUR', 'MKD')
 * @returns The currency symbol or the currency code if not found
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_CONFIGS[currency]?.symbol || currency;
}

/** Format an amount with its currency symbol in the correct position and thousand separators. */
export function formatCurrencyAmount(
  amount: number | string,
  currency: string,
  decimals?: number
): string {
  const config = CURRENCY_CONFIGS[currency];
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const fixedAmount = numAmount.toFixed(decimals ?? config?.decimals ?? 2);
  const formattedAmount = formatAmount(fixedAmount);

  if (!config) {
    return `${formattedAmount} ${currency}`;
  }

  if (config.position === 'before') {
    return `${config.symbol}${formattedAmount}`;
  } else {
    return `${formattedAmount} ${config.symbol}`;
  }
}

/** Format an amount with its currency symbol, prefixed with - for expenses and + for income. */
export function formatRecordAmount(
  amount: number | string,
  currency: string,
  isExpense: boolean,
  decimals?: number
): string {
  const sign = isExpense ? '-' : '+';
  const formattedAmount = formatCurrencyAmount(amount, currency, decimals);
  return `${sign}${formattedAmount}`;
}
