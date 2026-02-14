import {CategoryType} from '../enums/CategoryType.ts';
import {Language} from '../enums/Language.ts';
import {Currency} from '../enums/Currency.ts';
import {DocumentType} from '../enums/DocumentType.ts';

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
  type: CategoryType;
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
  language: Language;
  currency: Currency;
}

export interface Session {
  id: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  refreshToken: string;
  isRevoked: boolean;
  expiresAt: string;
}

export interface RecordSummary {
  amount: number;
  currency: string;
}

export interface RecordGroup {
  date: string;
  formattedDate: string;
  records: FinancialRecord[];
}

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

export interface LegalDocument {
  id: number;
  createdAt: string;
  updatedAt: string;
  type: DocumentType;
  version: number;
  title: string;
  content: string;
  effectiveAt: string;
  isActive: boolean;
  requiresReconsent: boolean;
}

export interface PendingDocumentsResponse {
  hasPendingDocuments: boolean;
  pendingDocuments: LegalDocument[];
}
