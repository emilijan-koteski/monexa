import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { PaymentMethod } from '../types/models';
import type { ApiResponse } from '../types/responses';
import { getStoredToken } from './authService';
import { apiClient } from '../api/apiClient';

const getAuthHeaders = () => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export const paymentMethodApi = {
  getAll: async (): Promise<PaymentMethod[]> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/payment-methods`, {
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

  create: async (data: { name: string }): Promise<PaymentMethod> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/payment-methods`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create payment method');
    }

    const result: ApiResponse<PaymentMethod> = await response.json();
    return result.data;
  },

  update: async (id: number, data: { name: string }): Promise<PaymentMethod> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/payment-methods/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update payment method');
    }

    const result: ApiResponse<PaymentMethod> = await response.json();
    return result.data;
  },

  delete: async (id: number): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/payment-methods/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete payment method');
    }
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

export const useCreatePaymentMethod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentMethodApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.all });
    },
  });
};

export const useUpdatePaymentMethod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string } }) =>
      paymentMethodApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.all });
    },
  });
};

export const useDeletePaymentMethod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentMethodApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.all });
    },
  });
};
