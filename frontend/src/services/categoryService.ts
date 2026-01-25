import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { Category } from '../types/models';
import type { ApiResponse } from '../types/responses';
import type { CategoryRequest } from '../types/requests';
import { apiClient, createAuthHeaders } from '../api/apiClient';

export const categoryApi = {
  getAll: async (): Promise<Category[]> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/categories`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch categories');
    }

    const result: ApiResponse<Category[]> = await response.json();
    return result.data;
  },

  getById: async (id: number): Promise<Category> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/categories/${id}`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch category');
    }

    const result: ApiResponse<Category> = await response.json();
    return result.data;
  },

  create: async (data: CategoryRequest): Promise<Category> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/categories`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create category');
    }

    const result: ApiResponse<Category> = await response.json();
    return result.data;
  },

  update: async (id: number, data: Partial<CategoryRequest>): Promise<Category> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/categories/${id}`, {
      method: 'PATCH',
      headers: createAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update category');
    }

    const result: ApiResponse<Category> = await response.json();
    return result.data;
  },

  delete: async (id: number): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/categories/${id}`, {
      method: 'DELETE',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete category');
    }
  },
};

export const categoryQueryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryQueryKeys.all, 'list'] as const,
  details: () => [...categoryQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...categoryQueryKeys.details(), id] as const,
};

export const useCategories = () => {
  return useQuery({
    queryKey: categoryQueryKeys.lists(),
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCategory = (id: number) => {
  return useQuery({
    queryKey: categoryQueryKeys.detail(id),
    queryFn: () => categoryApi.getById(id),
    enabled: !!id && id > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: categoryApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CategoryRequest> }) =>
      categoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: categoryApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all });
    },
  });
};
