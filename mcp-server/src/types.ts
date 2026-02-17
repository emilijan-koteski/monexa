export interface User {
  id: number;
  createdAt: string;
  updatedAt: string;
  email: string;
  name: string;
}

export interface FinancialRecord {
  id: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  categoryId: number;
  paymentMethodId: number;
  amount: string;
  currency: string;
  description?: string;
  date: string;
}

export interface Category {
  id: number;
  userId: number;
  name: string;
  type: "INCOME" | "EXPENSE";
  description?: string;
  color?: string;
}

export interface PaymentMethod {
  id: number;
  userId: number;
  name: string;
}

export interface Setting {
  id: number;
  userId: number;
  language: "EN" | "MK";
  currency: "MKD" | "EUR" | "USD" | "AUD" | "CHF" | "GBP";
}

export interface RecordSummary {
  amount: number;
  currency: string;
}

export interface CategoryStatItem {
  categoryId: number;
  categoryName: string;
  categoryType: "INCOME" | "EXPENSE";
  color?: string;
  recordCount: number;
  totalAmount: number;
}

export interface CategoryStatistics {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  currency: string;
  categories: CategoryStatItem[];
}

export interface LoginResponse {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: User;
}

export interface RenewTokenResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
}
