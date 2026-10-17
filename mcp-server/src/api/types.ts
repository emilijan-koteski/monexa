export type Currency = "MKD" | "EUR" | "USD" | "AUD" | "CHF" | "GBP";
export type Language = "EN" | "MK";
export type CategoryType = "INCOME" | "EXPENSE";
export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

/** Timestamps are RFC 3339 strings as serialized by the Go backend. */
export type Timestamp = string;

export interface User {
  id: number;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  ppid: string;
  email: string;
  name: string;
}

export interface Setting {
  id: number;
  userId: number;
  language: Language;
  currency: Currency;
}

export interface Category {
  id: number;
  userId: number;
  name: string;
  type: CategoryType;
  description: string | null;
  color: string | null;
}

export interface PaymentMethod {
  id: number;
  userId: number;
  name: string;
}

export interface FinancialRecord {
  id: number;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  userId: number;
  categoryId: number;
  paymentMethodId: number;
  amount: number;
  currency: Currency;
  description: string | null;
  date: Timestamp;
  recurringExpenseId: number | null;
}

export interface RecurringExpense {
  id: number;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  userId: number;
  categoryId: number;
  paymentMethodId: number;
  amount: number;
  currency: Currency;
  description: string | null;
  frequency: Frequency;
  startDate: Timestamp;
  endDate: Timestamp | null;
  isActive: boolean;
  nextRunDate: Timestamp;
  lastGeneratedAt: Timestamp | null;
}

export interface TrendReport {
  id: number;
  userId: number;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  title: string | null;
  description: string | null;
  color: string | null;
  categories: Category[];
}

export interface MonthlyDataPoint {
  month: number;
  amount: number;
}

export interface TrendReportMonthlyData {
  data: MonthlyDataPoint[];
  currency: Currency;
  year: number;
}

export interface MonthlyDetailItem {
  label: string;
  categoryName: string;
  categoryId: number;
  amount: number;
  isUngrouped: boolean;
}

export interface MonthlyDetailGroup {
  month: number;
  items: MonthlyDetailItem[];
}

export interface TrendReportMonthlyDetails {
  data: MonthlyDetailGroup[];
  currency: Currency;
  year: number;
}

export interface CategoryStatItem {
  categoryId: number;
  categoryName: string;
  categoryType: CategoryType;
  color: string | null;
  recordCount: number;
  totalAmount: number;
}

export interface CategoryStatistics {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  currency: Currency;
  categories: CategoryStatItem[];
}

export interface RecordSummary {
  amount: number;
  currency: Currency;
}
