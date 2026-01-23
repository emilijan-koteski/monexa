import { useQuery } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { CategoryStatistics } from '../types/models';
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

export interface CategoryStatisticsFilter {
  startDate?: string;
  endDate?: string;
  paymentMethodIds?: number[];
  search?: string;
}

export const categoryStatisticsApi = {
  getStatistics: async (filter: CategoryStatisticsFilter): Promise<CategoryStatistics> => {
    const params = new URLSearchParams();
    if (filter.startDate) params.append('startDate', filter.startDate);
    if (filter.endDate) params.append('endDate', filter.endDate);
    if (filter.paymentMethodIds?.length) {
      filter.paymentMethodIds.forEach(id => params.append('paymentMethodIds', id.toString()));
    }
    if (filter.search) params.append('search', filter.search);

    const response = await apiClient(`${API_BASE_URL}/categories/statistics?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch category statistics');
    }

    const result: ApiResponse<CategoryStatistics> = await response.json();
    return result.data;
  },
};

export const categoryStatisticsQueryKeys = {
  all: ['categoryStatistics'] as const,
  statistics: (filter: CategoryStatisticsFilter) =>
    [...categoryStatisticsQueryKeys.all, filter] as const,
};

export const useCategoryStatistics = (filter: CategoryStatisticsFilter) => {
  return useQuery({
    queryKey: categoryStatisticsQueryKeys.statistics(filter),
    queryFn: () => categoryStatisticsApi.getStatistics(filter),
    staleTime: 0,
    gcTime: 0,
  });
};
