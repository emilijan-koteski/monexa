import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import type { LegalDocument, PendingDocumentsResponse } from '../types/models';
import type { ApiResponse } from '../types/responses';
import { apiClient, createAuthHeaders } from '../api/apiClient';
import { DocumentType } from '../enums/DocumentType';

export const legalDocumentApi = {
  getActiveDocuments: async (): Promise<LegalDocument[]> => {
    const response = await fetch(`${ENV.API_BASE_URL}/legal-documents`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch legal documents');
    }

    const result: ApiResponse<LegalDocument[]> = await response.json();
    return result.data;
  },

  getDocumentByType: async (type: DocumentType): Promise<LegalDocument> => {
    const response = await fetch(`${ENV.API_BASE_URL}/legal-documents/${type}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch legal document');
    }

    const result: ApiResponse<LegalDocument> = await response.json();
    return result.data;
  },

  getPendingDocuments: async (): Promise<PendingDocumentsResponse> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/legal-documents/pending`, {
      method: 'GET',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch pending documents');
    }

    const result: ApiResponse<PendingDocumentsResponse> = await response.json();
    return result.data;
  },

  acceptDocument: async (documentId: number): Promise<void> => {
    const response = await apiClient(`${ENV.API_BASE_URL}/legal-documents/${documentId}/accept`, {
      method: 'POST',
      headers: createAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to accept document');
    }
  },
};

export const legalDocumentQueryKeys = {
  all: ['legalDocuments'] as const,
  active: () => [...legalDocumentQueryKeys.all, 'active'] as const,
  pending: () => [...legalDocumentQueryKeys.all, 'pending'] as const,
  byType: (type: DocumentType) => [...legalDocumentQueryKeys.all, 'type', type] as const,
};

export const useActiveDocuments = () => {
  return useQuery({
    queryKey: legalDocumentQueryKeys.active(),
    queryFn: legalDocumentApi.getActiveDocuments,
    staleTime: 60 * 60 * 1000,
  });
};

export const useDocumentByType = (type: DocumentType) => {
  return useQuery({
    queryKey: legalDocumentQueryKeys.byType(type),
    queryFn: () => legalDocumentApi.getDocumentByType(type),
    staleTime: 60 * 60 * 1000,
  });
};

export const usePendingDocuments = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: legalDocumentQueryKeys.pending(),
    queryFn: legalDocumentApi.getPendingDocuments,
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
};

export const useAcceptDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: legalDocumentApi.acceptDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalDocumentQueryKeys.pending() });
    },
  });
};
