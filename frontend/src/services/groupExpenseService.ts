import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GroupBalances,
  GroupExpense,
  GroupExpenseRequest,
  GroupSettlement,
  GroupSettlementRequest,
  GroupStats,
  RateQuote,
} from '../types/groups';
import { groupQueryKeys, groupRequest, invalidateGroupData } from './groupService';

const jsonBody = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export const groupExpenseApi = {
  list: (groupId: number) => groupRequest<GroupExpense[]>(`/groups/${groupId}/expenses`),
  create: ({ groupId, data }: { groupId: number; data: GroupExpenseRequest }) =>
    groupRequest<GroupExpense>(`/groups/${groupId}/expenses`, jsonBody('POST', data)),
  update: ({ groupId, expenseId, data }: { groupId: number; expenseId: number; data: GroupExpenseRequest }) =>
    groupRequest<GroupExpense>(`/groups/${groupId}/expenses/${expenseId}`, jsonBody('PATCH', data)),
  remove: ({ groupId, expenseId, version }: { groupId: number; expenseId: number; version: number }) =>
    groupRequest<void>(`/groups/${groupId}/expenses/${expenseId}?version=${version}&removeSettlements=true`, jsonBody('DELETE')),
  settlements: (groupId: number) => groupRequest<GroupSettlement[]>(`/groups/${groupId}/settlements`),
  createSettlement: ({ groupId, data }: { groupId: number; data: GroupSettlementRequest }) =>
    groupRequest<GroupSettlement>(`/groups/${groupId}/settlements`, jsonBody('POST', data)),
  removeSettlement: ({ groupId, settlementId }: { groupId: number; settlementId: number }) =>
    groupRequest<void>(`/groups/${groupId}/settlements/${settlementId}`, jsonBody('DELETE')),
  balances: (groupId: number) => groupRequest<GroupBalances>(`/groups/${groupId}/balances`),
  stats: (groupId: number) => groupRequest<GroupStats>(`/groups/${groupId}/stats`),
  rate: (from: string, to: string, date: string) =>
    groupRequest<RateQuote>(`/exchange-rates/rate?from=${from}&to=${to}&date=${date}`),
};

export const rateQueryKeys = {
  rate: (from: string, to: string, date: string) => ['exchange-rates', from, to, date] as const,
};

const liveQuery = { refetchOnWindowFocus: true } as const;

export const useGroupExpenses = (groupId: number) =>
  useQuery({ queryKey: groupQueryKeys.expenses(groupId), queryFn: () => groupExpenseApi.list(groupId), enabled: groupId > 0, ...liveQuery });

export const useGroupSettlements = (groupId: number) =>
  useQuery({ queryKey: groupQueryKeys.settlements(groupId), queryFn: () => groupExpenseApi.settlements(groupId), enabled: groupId > 0, ...liveQuery });

export const useGroupBalances = (groupId: number) =>
  useQuery({ queryKey: groupQueryKeys.balances(groupId), queryFn: () => groupExpenseApi.balances(groupId), enabled: groupId > 0, ...liveQuery });

export const useGroupStats = (groupId: number, enabled = true) =>
  useQuery({ queryKey: groupQueryKeys.stats(groupId), queryFn: () => groupExpenseApi.stats(groupId), enabled: enabled && groupId > 0, ...liveQuery });

export const useRateQuote = (from: string, to: string, date: string, enabled: boolean) =>
  useQuery({
    queryKey: rateQueryKeys.rate(from, to, date),
    queryFn: () => groupExpenseApi.rate(from, to, date),
    enabled: enabled && from !== to,
    staleTime: 5 * 60 * 1000,
  });

const useFinanceMutation = <TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateGroupData(queryClient),
  });
};

export const useCreateGroupExpense = () => useFinanceMutation(groupExpenseApi.create);
export const useUpdateGroupExpense = () => useFinanceMutation(groupExpenseApi.update);
export const useCreateSettlement = () => useFinanceMutation(groupExpenseApi.createSettlement);
