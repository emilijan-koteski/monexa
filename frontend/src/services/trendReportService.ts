import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { TrendReport } from '../types/models';
import type { ApiResponse, TrendReportMonthlyData } from '../types/responses';
import type { TrendReportRequest } from '../types/requests';
import { apiClient, createAuthHeaders } from '../api/apiClient';

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

  getMonthlyData: async (id: number, year: number): Promise<TrendReportMonthlyData> => {
    const response = await apiClient(
      `${ENV.API_BASE_URL}/trend-reports/${id}/monthly-data?year=${year}`,
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
  monthlyData: (id: number, year: number) =>
    [...trendReportQueryKeys.detail(id), 'monthly-data', year] as const,
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

export const useTrendReportMonthlyData = (id: number, year: number) => {
  return useQuery({
    queryKey: trendReportQueryKeys.monthlyData(id, year),
    queryFn: () => trendReportApi.getMonthlyData(id, year),
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
