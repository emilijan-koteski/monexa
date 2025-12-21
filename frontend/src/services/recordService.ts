import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { FinancialRecord, RecordSummary } from '../types/models';
import type { RecordRequest } from '../types/requests';
import type { ApiResponse } from '../types/responses';
import { getStoredToken } from './authService';
import { apiClient } from '../api/apiClient';

const API_BASE_URL = ENV.API_BASE_URL;

const getAuthHeaders = () => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export const recordApi = {
  getAll: async (startDate?: string, endDate?: string): Promise<FinancialRecord[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await apiClient(`${API_BASE_URL}/records?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch records');
    }

    const result: ApiResponse<FinancialRecord[]> = await response.json();
    return Array.isArray(result.data) ? result.data : [];
  },

  getById: async (id: number): Promise<FinancialRecord> => {
    const response = await apiClient(`${API_BASE_URL}/records/${id}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch record');
    }

    const result: ApiResponse<FinancialRecord> = await response.json();
    return result.data;
  },

  create: async (data: RecordRequest): Promise<FinancialRecord> => {
    const response = await apiClient(`${API_BASE_URL}/records`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create record');
    }

    const result: ApiResponse<FinancialRecord> = await response.json();
    return result.data;
  },

  update: async (id: number, data: RecordRequest): Promise<FinancialRecord> => {
    const response = await apiClient(`${API_BASE_URL}/records/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update record');
    }

    const result: ApiResponse<FinancialRecord> = await response.json();
    return result.data;
  },

  delete: async (id: number): Promise<void> => {
    const response = await apiClient(`${API_BASE_URL}/records/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete record');
    }
  },

  getSummary: async (startDate?: string, endDate?: string): Promise<RecordSummary> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await apiClient(`${API_BASE_URL}/records/summary?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch summary');
    }

    const result: ApiResponse<RecordSummary> = await response.json();
    return result.data;
  },
};

export const recordQueryKeys = {
  all: ['records'] as const,
  lists: () => [...recordQueryKeys.all, 'list'] as const,
  list: (startDate?: string, endDate?: string) =>
    [...recordQueryKeys.lists(), { startDate, endDate }] as const,
  details: () => [...recordQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...recordQueryKeys.details(), id] as const,
  summaries: () => [...recordQueryKeys.all, 'summary'] as const,
  summary: (startDate?: string, endDate?: string) =>
    [...recordQueryKeys.summaries(), { startDate, endDate }] as const,
};

export const useRecords = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: recordQueryKeys.list(startDate, endDate),
    queryFn: () => recordApi.getAll(startDate, endDate),
    staleTime: 0, // Consider data stale immediately
    gcTime: 0, // Don't cache unused data
  });
};

export const useRecord = (id: number) => {
  return useQuery({
    queryKey: recordQueryKeys.detail(id),
    queryFn: () => recordApi.getById(id),
    enabled: !!id,
  });
};

export const useRecordSummary = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: recordQueryKeys.summary(startDate, endDate),
    queryFn: () => recordApi.getSummary(startDate, endDate),
    staleTime: 0,
    gcTime: 0,
  });
};

export const useCreateRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordQueryKeys.all });
    },
  });
};

export const useUpdateRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RecordRequest }) =>
      recordApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordQueryKeys.all });
    },
  });
};

export const useDeleteRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordQueryKeys.all });
    },
  });
};
