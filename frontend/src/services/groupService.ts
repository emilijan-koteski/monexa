import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ENV } from '../config/env';
import { apiClient, createAuthHeaders } from '../api/apiClient';
import type { ApiResponse } from '../types/responses';
import type { Group, GroupJoinPreview, GroupMeRequest, GroupRequest, GroupSummary } from '../types/groups';
import { recordQueryKeys } from './recordService';
import { trendReportQueryKeys } from './trendReportService';
import { categoryStatisticsQueryKeys } from './categoryStatisticsService';

const API_BASE_URL = ENV.API_BASE_URL;

export class GroupRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GroupRequestError';
    this.status = status;
  }
}

export const isGroupError = (error: unknown, status: number): boolean =>
  error instanceof GroupRequestError && error.status === status;

/** Sends a request to the groups API and unwraps the data envelope, throwing GroupRequestError with the status on failure. */
export async function groupRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiClient(`${API_BASE_URL}${path}`, { ...init, headers: createAuthHeaders() });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new GroupRequestError(body?.message || body?.error || 'Request failed', response.status);
  }
  const result: ApiResponse<T> = await response.json();
  return result.data;
}

const jsonBody = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export const groupApi = {
  list: () => groupRequest<GroupSummary[]>('/groups'),
  get: (id: number) => groupRequest<Group>(`/groups/${id}`),
  create: (data: GroupRequest) => groupRequest<Group>('/groups', jsonBody('POST', data)),
  update: ({ id, data }: { id: number; data: GroupRequest }) => groupRequest<Group>(`/groups/${id}`, jsonBody('PATCH', data)),
  remove: (id: number) => groupRequest<void>(`/groups/${id}`, jsonBody('DELETE')),
  regenerateInvite: (id: number) => groupRequest<Group>(`/groups/${id}/invite-code`, jsonBody('POST')),
  disableInvite: (id: number) => groupRequest<Group>(`/groups/${id}/invite-code`, jsonBody('DELETE')),
  joinPreview: (code: string) => groupRequest<GroupJoinPreview>(`/groups/join/${encodeURIComponent(code)}`),
  join: ({ code, memberId, displayName }: { code: string; memberId?: number; displayName?: string }) =>
    groupRequest<{ groupId: number; memberId: number }>(`/groups/join/${encodeURIComponent(code)}`, jsonBody('POST', { memberId, displayName })),
  addMember: ({ groupId, displayName }: { groupId: number; displayName: string }) =>
    groupRequest<Group>(`/groups/${groupId}/members`, jsonBody('POST', { displayName })),
  updateMember: ({ groupId, memberId, displayName, role }: { groupId: number; memberId: number; displayName?: string; role?: string }) =>
    groupRequest<Group>(`/groups/${groupId}/members/${memberId}`, jsonBody('PATCH', { displayName, role })),
  removeMember: ({ groupId, memberId }: { groupId: number; memberId: number }) =>
    groupRequest<Group>(`/groups/${groupId}/members/${memberId}`, jsonBody('DELETE')),
  unlinkMember: ({ groupId, memberId }: { groupId: number; memberId: number }) =>
    groupRequest<Group>(`/groups/${groupId}/members/${memberId}/link`, jsonBody('DELETE')),
  updateMe: ({ groupId, data }: { groupId: number; data: GroupMeRequest }) =>
    groupRequest<Group>(`/groups/${groupId}/me`, jsonBody('PATCH', data)),
  leave: ({ groupId, keepRecords }: { groupId: number; keepRecords: boolean }) =>
    groupRequest<void>(`/groups/${groupId}/me?keepRecords=${keepRecords}`, jsonBody('DELETE')),
};

export const groupQueryKeys = {
  all: ['groups'] as const,
  lists: () => [...groupQueryKeys.all, 'list'] as const,
  detail: (id: number) => [...groupQueryKeys.all, 'detail', id] as const,
  group: (id: number) => [...groupQueryKeys.detail(id), 'group'] as const,
  expenses: (id: number) => [...groupQueryKeys.detail(id), 'expenses'] as const,
  settlements: (id: number) => [...groupQueryKeys.detail(id), 'settlements'] as const,
  balances: (id: number) => [...groupQueryKeys.detail(id), 'balances'] as const,
  stats: (id: number) => [...groupQueryKeys.detail(id), 'stats'] as const,
  joinPreview: (code: string) => [...groupQueryKeys.all, 'join', code] as const,
};

/** Refreshes every group query plus the personal records and stats that synced shares feed into. */
export function invalidateGroupData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: groupQueryKeys.all });
  queryClient.invalidateQueries({ queryKey: recordQueryKeys.all });
  queryClient.invalidateQueries({ queryKey: trendReportQueryKeys.all });
  queryClient.invalidateQueries({ queryKey: categoryStatisticsQueryKeys.all });
}

export const useGroups = (enabled = true) =>
  useQuery({ queryKey: groupQueryKeys.lists(), queryFn: groupApi.list, refetchOnWindowFocus: true, enabled });

export const isManagedRecord = (record: { groupExpenseShareId?: number | null; groupSyncDetachedAt?: string | null }): boolean =>
  !!record.groupExpenseShareId && !record.groupSyncDetachedAt;

export const useGroup = (id: number) =>
  useQuery({ queryKey: groupQueryKeys.group(id), queryFn: () => groupApi.get(id), enabled: id > 0, refetchOnWindowFocus: true });

export const useJoinPreview = (code: string) =>
  useQuery({ queryKey: groupQueryKeys.joinPreview(code), queryFn: () => groupApi.joinPreview(code), enabled: code.length > 0 });

const useGroupMutation = <TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateGroupData(queryClient),
  });
};

export const useCreateGroup = () => useGroupMutation(groupApi.create);
export const useUpdateGroup = () => useGroupMutation(groupApi.update);
export const useDeleteGroup = () => useGroupMutation(groupApi.remove);
export const useRegenerateInvite = () => useGroupMutation(groupApi.regenerateInvite);
export const useDisableInvite = () => useGroupMutation(groupApi.disableInvite);
export const useJoinGroup = () => useGroupMutation(groupApi.join);
export const useAddMember = () => useGroupMutation(groupApi.addMember);
export const useUpdateMember = () => useGroupMutation(groupApi.updateMember);
export const useRemoveMember = () => useGroupMutation(groupApi.removeMember);
export const useUnlinkMember = () => useGroupMutation(groupApi.unlinkMember);
export const useUpdateMe = () => useGroupMutation(groupApi.updateMe);
export const useLeaveGroup = () => useGroupMutation(groupApi.leave);
