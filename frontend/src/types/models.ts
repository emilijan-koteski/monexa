import {CategoryType} from '../enums/CategoryType.ts';
import {Language} from '../enums/Language.ts';
import {Currency} from '../enums/Currency.ts';

export interface User {
  id: number;
  createdAt: string;
  updatedAt: string;
  email: string;
  name: string;
}

export interface Record {
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