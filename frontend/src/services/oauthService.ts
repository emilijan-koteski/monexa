import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { OAuthAuthorization, OAuthGrant } from '../types/models';
import type { ApiResponse, OAuthRedirectResponse } from '../types/responses';
import { apiClient, createAuthHeaders } from '../api/apiClient';

const NOT_FOUND_STATUS = 404;
const MAX_AUTHORIZATION_ATTEMPTS = 2;

export const accessTokensQueryKey = ['accessTokens'] as const;

export class OAuthRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OAuthRequestError';
    this.status = status;
  }
}

export const isOAuthNotFoundError = (error: unknown): boolean =>
  error instanceof OAuthRequestError && error.status === NOT_FOUND_STATUS;

const failFromResponse = async (response: Response, fallbackMessage: string): Promise<never> => {
  const body = await response.json().catch(() => null);
  throw new OAuthRequestError(body?.message || body?.error || fallbackMessage, response.status);
};

export const oauthApi = {
  getAuthorization: async (id: string): Promise<OAuthAuthorization> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/oauth/authorizations/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      return failFromResponse(response, 'Failed to fetch authorization request');
    }

    const result: ApiResponse<OAuthAuthorization> = await response.json();
    return result.data;
  },

  approveAuthorization: async (id: string): Promise<OAuthRedirectResponse> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/oauth/authorizations/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      return failFromResponse(response, 'Failed to approve authorization request');
    }

    const result: ApiResponse<OAuthRedirectResponse> = await response.json();
    return result.data;
  },

  denyAuthorization: async (id: string): Promise<OAuthRedirectResponse> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/oauth/authorizations/${encodeURIComponent(id)}/deny`, {
      method: 'POST',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      return failFromResponse(response, 'Failed to deny authorization request');
    }

    const result: ApiResponse<OAuthRedirectResponse> = await response.json();
    return result.data;
  },

  getOAuthGrants: async (): Promise<OAuthGrant[]> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/oauth/grants`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      return failFromResponse(response, 'Failed to fetch connected apps');
    }

    const result: ApiResponse<OAuthGrant[]> = await response.json();
    return Array.isArray(result.data) ? result.data : [];
  },

  revokeOAuthGrant: async (id: number): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/oauth/grants/${id}`, {
      method: 'DELETE',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      return failFromResponse(response, 'Failed to disconnect app');
    }
  },
};

export const oauthQueryKeys = {
  all: ['oauth'] as const,
  authorizations: () => [...oauthQueryKeys.all, 'authorization'] as const,
  authorization: (id: string) => [...oauthQueryKeys.authorizations(), id] as const,
  grants: () => [...oauthQueryKeys.all, 'grants'] as const,
};

export const useOAuthAuthorization = (id: string | null) => {
  return useQuery({
    queryKey: oauthQueryKeys.authorization(id ?? ''),
    queryFn: () => oauthApi.getAuthorization(id ?? ''),
    enabled: !!id,
    retry: (failureCount, error) => !isOAuthNotFoundError(error) && failureCount < MAX_AUTHORIZATION_ATTEMPTS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

export const useApproveAuthorization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: oauthApi.approveAuthorization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oauthQueryKeys.grants() });
    },
  });
};

export const useDenyAuthorization = () => {
  return useMutation({
    mutationFn: oauthApi.denyAuthorization,
  });
};

export const useOAuthGrants = () => {
  return useQuery({
    queryKey: oauthQueryKeys.grants(),
    queryFn: oauthApi.getOAuthGrants,
  });
};

export const useRevokeOAuthGrant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: oauthApi.revokeOAuthGrant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oauthQueryKeys.grants() });
      queryClient.invalidateQueries({ queryKey: accessTokensQueryKey });
    },
  });
};
