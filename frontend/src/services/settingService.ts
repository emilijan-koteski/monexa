import { useQuery } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { Setting } from '../types/models';
import type { ApiResponse } from '../types/responses';
import { getStoredToken } from './authService';

const API_BASE_URL = ENV.API_BASE_URL;

const getAuthHeaders = () => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export const settingApi = {
  get: async (): Promise<Setting> => {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch settings');
    }

    const result: ApiResponse<Setting> = await response.json();
    return result.data;
  },
};

export const settingQueryKeys = {
  all: ['settings'] as const,
  detail: () => [...settingQueryKeys.all, 'detail'] as const,
};

export const useSettings = () => {
  return useQuery({
    queryKey: settingQueryKeys.detail(),
    queryFn: settingApi.get,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
