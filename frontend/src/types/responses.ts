import type { FinancialRecord, User } from './models';
import { CategoryType } from '../enums/CategoryType.ts';

// Generic API Response Wrapper
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Authentication Response
export interface AuthResponse {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: User;
}

// Record Responses
export interface RecordSummary {
  amount: number;
  currency: string;
}

export interface RecordGroup {
  date: string;
  formattedDate: string;
  records: FinancialRecord[];
}

// Category Responses
export interface CategoryStatItem {
  categoryId: number;
  categoryName: string;
  categoryType: CategoryType;
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

// Trend Report Responses
export interface MonthlyDataPoint {
  month: number;
  amount: number;
}

export interface TrendReportMonthlyData {
  data: MonthlyDataPoint[];
  currency: string;
  year: number;
}
