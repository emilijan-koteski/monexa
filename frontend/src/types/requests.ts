// Authentication Requests
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  acceptedDocumentIds: number[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateUserRequest {
  name: string;
}

// Record Requests
export interface RecordRequest {
  categoryId: number;
  paymentMethodId: number;
  amount: number;
  currency: string;
  description?: string;
  date: string;
}

export interface RecordFilter {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  paymentMethodIds?: number[];
  search?: string;
  sortBy?: 'date' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

// Category Requests
export interface CategoryRequest {
  name: string;
  type: string;
  description?: string;
  color?: string;
}
