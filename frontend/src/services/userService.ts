import { useMutation } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { User } from '../types/models';
import type { ExportDataRequest, UpdateUserRequest } from '../types/requests';
import { apiClient } from '../api/apiClient';
import { tokenUtils } from '../utils/tokenUtils';

export const userApi = {
  updateUser: async (data: UpdateUserRequest): Promise<User> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/users`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUtils.getAccessToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'User update failed');
    }

    const result = await response.json();
    return result.data;
  },

  downloadData: async (request: ExportDataRequest): Promise<Blob> => {
    const params = new URLSearchParams();
    if (request.format) params.append('format', request.format);
    if (request.categories && request.categories.length > 0) {
      params.append('categories', request.categories.join(','));
    }
    if (request.startDate) params.append('startDate', request.startDate);
    if (request.endDate) params.append('endDate', request.endDate);

    const response = await apiClient(`${ENV.API_BASE_URL}/users/data/export?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenUtils.getAccessToken()}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to download data');
    }

    return await response.blob();
  },
};

export const useUpdateUser = () => {
  return useMutation({
    mutationFn: userApi.updateUser,
    onSuccess: (user) => {
      tokenUtils.setUser(user);
    },
  });
};

export const useDownloadData = () => {
  return useMutation({
    mutationFn: (request: ExportDataRequest) => userApi.downloadData(request),
  });
};
