import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ENV } from '../config/env';
import type { User } from '../types/models';
import type { ChangePasswordRequest, LoginRequest, RegisterRequest } from '../types/requests';
import type { AuthResponse } from '../types/responses';
import { apiClient } from '../api/apiClient';
import { tokenUtils } from '../utils/tokenUtils';

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const result = await response.json();
    return result.data;
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    const result = await response.json();
    return result.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Logout failed');
    }
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUtils.getAccessToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Password change failed');
    }
  },
};

export const authQueryKeys = {
  all: ['auth'] as const,
  user: () => [...authQueryKeys.all, 'user'] as const,
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      tokenUtils.setTokens(
        data.accessToken,
        data.accessTokenExpiresAt,
        data.refreshToken,
        data.refreshTokenExpiresAt
      );
      tokenUtils.setUser(data.user);

      queryClient.invalidateQueries({ queryKey: authQueryKeys.user() });
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: authApi.register,
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => {
      const refreshToken = tokenUtils.getRefreshToken();
      if (!refreshToken) {
        return Promise.resolve();
      }
      return authApi.logout(refreshToken);
    },
    onSuccess: () => {
      tokenUtils.clearTokens();
      queryClient.clear();
      navigate('/login');
    },
    onError: () => {
      tokenUtils.clearTokens();
      queryClient.clear();
      navigate('/login');
    },
  });
};

export const useChangePassword = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      tokenUtils.clearTokens();
      queryClient.clear();
      navigate('/login');
    },
  });
};
