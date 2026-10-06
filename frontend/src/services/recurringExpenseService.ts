import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { RecurringExpense } from '../types/models';
import type { ApiResponse } from '../types/responses';
import type { RecurringExpenseRequest } from '../types/requests';
import { apiClient, createAuthHeaders } from '../api/apiClient';
import { recordQueryKeys } from './recordService';
import { trendReportQueryKeys } from './trendReportService';

export const recurringExpenseApi = {
  getAll: async (): Promise<RecurringExpense[]> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/recurring-expenses`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch recurring expenses');
    }

    const result: ApiResponse<RecurringExpense[]> = await response.json();
    return Array.isArray(result.data) ? result.data : [];
  },

  getById: async (id: number): Promise<RecurringExpense> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/recurring-expenses/${id}`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch recurring expense');
    }

    const result: ApiResponse<RecurringExpense> = await response.json();
    return result.data;
  },

  create: async (data: RecurringExpenseRequest): Promise<RecurringExpense> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/recurring-expenses`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create recurring expense');
    }

    const result: ApiResponse<RecurringExpense> = await response.json();
    return result.data;
  },

  update: async (id: number, data: Partial<RecurringExpenseRequest>): Promise<RecurringExpense> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/recurring-expenses/${id}`, {
      method: 'PATCH',
      headers: createAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update recurring expense');
    }

    const result: ApiResponse<RecurringExpense> = await response.json();
    return result.data;
  },

  delete: async (id: number): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/recurring-expenses/${id}`, {
      method: 'DELETE',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete recurring expense');
    }
  },
};

export const recurringExpenseQueryKeys = {
  all: ['recurringExpenses'] as const,
  lists: () => [...recurringExpenseQueryKeys.all, 'list'] as const,
  details: () => [...recurringExpenseQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...recurringExpenseQueryKeys.details(), id] as const,
};

export const useRecurringExpenses = () => {
  return useQuery({
    queryKey: recurringExpenseQueryKeys.lists(),
    queryFn: recurringExpenseApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useRecurringExpense = (id: number) => {
  return useQuery({
    queryKey: recurringExpenseQueryKeys.detail(id),
    queryFn: () => recurringExpenseApi.getById(id),
    enabled: !!id && id > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateRecurringExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recurringExpenseApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringExpenseQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: recordQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: trendReportQueryKeys.all });
    },
  });
};

export const useUpdateRecurringExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RecurringExpenseRequest> }) =>
      recurringExpenseApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringExpenseQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: recordQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: trendReportQueryKeys.all });
    },
  });
};

export const useDeleteRecurringExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recurringExpenseApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringExpenseQueryKeys.all });
    },
  });
};
