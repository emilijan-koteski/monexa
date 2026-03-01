import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { TrendReport } from '../types/models';
import type { ApiResponse, TrendReportMonthlyData, TrendReportMonthlyDetails } from '../types/responses';
import type { TrendReportRequest } from '../types/requests';
import { apiClient, createAuthHeaders } from '../api/apiClient';
import { CategoryType } from '../enums/CategoryType';

export const trendReportApi = {
  getAll: async (): Promise<TrendReport[]> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/trend-reports`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch trend reports');
    }

    const result: ApiResponse<TrendReport[]> = await response.json();
    return result.data;
  },

  getById: async (id: number): Promise<TrendReport> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/trend-reports/${id}`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch trend report');
    }

    const result: ApiResponse<TrendReport> = await response.json();
    return result.data;
  },

  getMonthlyData: async (id: number, year: number, type?: CategoryType): Promise<TrendReportMonthlyData> => {
    const params = new URLSearchParams({ year: String(year) });
    if (type) params.set('type', type);

    const response = await apiClient(
      `${ENV.API_BASE_URL}/trend-reports/${id}/monthly-data?${params.toString()}`,
      {
        method: 'GET',
        headers: createAuthHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch monthly data');
    }

    const result: ApiResponse<TrendReportMonthlyData> = await response.json();
    return result.data;
  },

  getMonthlyDetails: async (id: number, year: number, type?: CategoryType): Promise<TrendReportMonthlyDetails> => {
    const params = new URLSearchParams({ year: String(year) });
    if (type) params.set('type', type);

    const response = await apiClient(
      `${ENV.API_BASE_URL}/trend-reports/${id}/monthly-details?${params.toString()}`,
      {
        method: 'GET',
        headers: createAuthHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch monthly details');
    }

    const result: ApiResponse<TrendReportMonthlyDetails> = await response.json();
    return result.data;
  },

  create: async (data: TrendReportRequest): Promise<TrendReport> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/trend-reports`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create trend report');
    }

    const result: ApiResponse<TrendReport> = await response.json();
    return result.data;
  },

  update: async (id: number, data: TrendReportRequest): Promise<TrendReport> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/trend-reports/${id}`, {
      method: 'PATCH',
      headers: createAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update trend report');
    }

    const result: ApiResponse<TrendReport> = await response.json();
    return result.data;
  },

  delete: async (id: number): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/trend-reports/${id}`, {
      method: 'DELETE',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete trend report');
    }
  },
};

export const trendReportQueryKeys = {
  all: ['trend-reports'] as const,
  lists: () => [...trendReportQueryKeys.all, 'list'] as const,
  details: () => [...trendReportQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...trendReportQueryKeys.details(), id] as const,
  monthlyData: (id: number, year: number, type?: CategoryType) =>
    [...trendReportQueryKeys.detail(id), 'monthly-data', year, type ?? 'ALL'] as const,
  monthlyDetails: (id: number, year: number, type?: CategoryType) =>
    [...trendReportQueryKeys.detail(id), 'monthly-details', year, type ?? 'ALL'] as const,
};

export const useTrendReports = () => {
  return useQuery({
    queryKey: trendReportQueryKeys.lists(),
    queryFn: trendReportApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useTrendReport = (id: number) => {
  return useQuery({
    queryKey: trendReportQueryKeys.detail(id),
    queryFn: () => trendReportApi.getById(id),
    enabled: !!id && id > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useTrendReportMonthlyData = (id: number, year: number, type?: CategoryType) => {
  return useQuery({
    queryKey: trendReportQueryKeys.monthlyData(id, year, type),
    queryFn: () => trendReportApi.getMonthlyData(id, year, type),
    enabled: !!id && id > 0 && year > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useTrendReportMonthlyDetails = (id: number, year: number, type?: CategoryType) => {
  return useQuery({
    queryKey: trendReportQueryKeys.monthlyDetails(id, year, type),
    queryFn: () => trendReportApi.getMonthlyDetails(id, year, type),
    enabled: !!id && id > 0 && year > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateTrendReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: trendReportApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trendReportQueryKeys.all });
    },
  });
};

export const useUpdateTrendReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TrendReportRequest }) =>
      trendReportApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trendReportQueryKeys.all });
    },
  });
};

export const useDeleteTrendReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: trendReportApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trendReportQueryKeys.all });
    },
  });
};
