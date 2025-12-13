import { useQuery } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { Category } from '../types/models';
import type { ApiResponse } from '../types/responses';
import { getStoredToken } from './authService';

const getAuthHeaders = () => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export const categoryApi = {
  getAll: async (): Promise<Category[]> => {
    const response = await fetch(`${ENV.API_BASE_URL}/categories`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch categories');
    }

    const result: ApiResponse<Category[]> = await response.json();
    return result.data;
  },
};

export const categoryQueryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryQueryKeys.all, 'list'] as const,
};

export const useCategories = () => {
  return useQuery({
    queryKey: categoryQueryKeys.lists(),
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
