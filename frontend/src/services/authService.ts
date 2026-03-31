import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ENV } from '../config/env';
import type { ChangePasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest } from '../types/requests';
import type { AuthResponse } from '../types/responses';
import { apiClient } from '../api/apiClient';
import { tokenUtils } from '../utils/tokenUtils';
import { userQueryKeys } from './userService';

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

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
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

  deleteAccount: async (): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/auth/accounts`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUtils.getAccessToken()}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Account deletion failed');
    }
  },

  forgotPassword: async (email: string): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send reset email');
    }
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<AuthResponse> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Password reset failed');
    }

    const result = await response.json();
    return result.data;
  },
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      tokenUtils.setTokens(data.accessToken, data.refreshToken);
      queryClient.invalidateQueries({ queryKey: userQueryKeys.me() });
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      tokenUtils.setTokens(data.accessToken, data.refreshToken);
      queryClient.invalidateQueries({ queryKey: userQueryKeys.me() });
    },
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

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.deleteAccount,
    onSuccess: () => {
      tokenUtils.clearTokens();
      queryClient.clear();
      navigate('/login');
    },
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });
};

export const useResetPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: (data) => {
      tokenUtils.setTokens(data.accessToken, data.refreshToken);
      queryClient.invalidateQueries({ queryKey: userQueryKeys.me() });
    },
  });
};
