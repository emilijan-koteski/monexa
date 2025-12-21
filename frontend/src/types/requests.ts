// Authentication Requests
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
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

// Category Requests
export interface CategoryRequest {
  name: string;
  type: string;
  description?: string;
  color?: string;
}
