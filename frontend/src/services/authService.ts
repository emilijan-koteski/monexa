import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { User } from '../types/models';
import type { LoginRequest, RegisterRequest } from '../types/requests';
import type { AuthResponse } from '../types/responses';

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await fetch(`${ENV.API_BASE_URL}/auth/login`, {
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
    const response = await fetch(`${ENV.API_BASE_URL}/auth/register`, {
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
    const response = await fetch(`${ENV.API_BASE_URL}/auth/logout`, {
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
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

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

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      queryClient.clear();
    },
  });
};

export const getStoredUser = (): User | null => {
  const userString = localStorage.getItem('user');
  return userString ? JSON.parse(userString) : null;
};

export const getStoredToken = (): string | null => {
  return localStorage.getItem('accessToken');
};

export const isAuthenticated = (): boolean => {
  return !!getStoredToken() && !!getStoredUser();
};
