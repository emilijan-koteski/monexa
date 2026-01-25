import { useMutation } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { User } from '../types/models';
import type { UpdateUserRequest } from '../types/requests';
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
};

export const useUpdateUser = () => {
  return useMutation({
    mutationFn: userApi.updateUser,
    onSuccess: (user) => {
      tokenUtils.setUser(user);
    },
  });
};
