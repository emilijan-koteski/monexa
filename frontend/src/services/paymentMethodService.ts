import { useQuery } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { PaymentMethod } from '../types/models';
import type { ApiResponse } from '../types/responses';
import { getStoredToken } from './authService';

const getAuthHeaders = () => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export const paymentMethodApi = {
  getAll: async (): Promise<PaymentMethod[]> => {
    const response = await fetch(`${ENV.API_BASE_URL}/payment-methods`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch payment methods');
    }

    const result: ApiResponse<PaymentMethod[]> = await response.json();
    return result.data;
  },
};

export const paymentMethodQueryKeys = {
  all: ['paymentMethods'] as const,
  lists: () => [...paymentMethodQueryKeys.all, 'list'] as const,
};

export const usePaymentMethods = () => {
  return useQuery({
    queryKey: paymentMethodQueryKeys.lists(),
    queryFn: paymentMethodApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
