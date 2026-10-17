import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { AccessToken, CreatedAccessToken } from '../types/models';
import type { AccessTokenRequest } from '../types/requests';
import type { ApiResponse } from '../types/responses';
import { apiClient, createAuthHeaders } from '../api/apiClient';
import { accessTokensQueryKey, oauthQueryKeys } from './oauthService';

const CONFLICT_STATUS = 409;
const NOT_FOUND_STATUS = 404;

export class AccessTokenRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AccessTokenRequestError';
    this.status = status;
  }
}

export const isAccessTokenLimitError = (error: unknown): boolean =>
  error instanceof AccessTokenRequestError && error.status === CONFLICT_STATUS;

export const isAccessTokenNotFoundError = (error: unknown): boolean =>
  error instanceof AccessTokenRequestError && error.status === NOT_FOUND_STATUS;

const failFromResponse = async (response: Response, fallbackMessage: string): Promise<never> => {
  const body = await response.json().catch(() => null);
  throw new AccessTokenRequestError(body?.message || body?.error || fallbackMessage, response.status);
};

export const accessTokenApi = {
  getAccessTokens: async (): Promise<AccessToken[]> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/access-tokens`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      return failFromResponse(response, 'Failed to fetch access tokens');
    }

    const result: ApiResponse<AccessToken[]> = await response.json();
    return Array.isArray(result.data) ? result.data : [];
  },

  createAccessToken: async (request: AccessTokenRequest): Promise<CreatedAccessToken> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/access-tokens`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return failFromResponse(response, 'Failed to create access token');
    }

    const result: ApiResponse<CreatedAccessToken> = await response.json();
    return result.data;
  },

  revokeAccessToken: async (id: number): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/access-tokens/${id}`, {
      method: 'DELETE',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      return failFromResponse(response, 'Failed to revoke access token');
    }
  },
};

export const accessTokenQueryKeys = {
  all: accessTokensQueryKey,
  lists: () => [...accessTokenQueryKeys.all, 'list'] as const,
};

export const useAccessTokens = () => {
  return useQuery({
    queryKey: accessTokenQueryKeys.lists(),
    queryFn: accessTokenApi.getAccessTokens,
  });
};

export const useCreateAccessToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accessTokenApi.createAccessToken,
    gcTime: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessTokenQueryKeys.all });
    },
  });
};

export const useRevokeAccessToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accessTokenApi.revokeAccessToken,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: accessTokenQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: oauthQueryKeys.grants() });
    },
  });
};
