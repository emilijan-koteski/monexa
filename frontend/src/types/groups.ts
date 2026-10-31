import { GroupExpenseCategory } from '../enums/GroupExpenseCategory.ts';
import { GroupMemberRole } from '../enums/GroupMemberRole.ts';
import { SplitType } from '../enums/SplitType.ts';

export type RateSource = 'EXCHANGE_RATE_API' | 'FALLBACK' | 'IDENTITY' | 'MANUAL';

export interface GroupMember {
  id: number;
  displayName: string;
  role: GroupMemberRole;
  isLinked: boolean;
  isMe: boolean;
  linkedAt: string | null;
}

export interface GroupMembership {
  memberId: number;
  role: GroupMemberRole;
  syncEnabled: boolean;
  syncCategoryId: number | null;
  syncPaymentMethodId: number | null;
  syncedRecordCount: number;
  keptRecordCount: number;
}

export interface Group {
  id: number;
  createdAt: string;
  name: string;
  icon: string;
  color: string;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  simplifyDebts: boolean;
  archivedAt: string | null;
  inviteCode: string | null;
  hasActivity: boolean;
  members: GroupMember[];
  me: GroupMembership;
}

export interface GroupSummary {
  id: number;
  name: string;
  icon: string;
  color: string;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  archivedAt: string | null;
  members: GroupMember[];
  myNet: number;
  pendingCount: number;
  expenseCount: number;
}

export interface GroupJoinPreview {
  groupId: number;
  name: string;
  icon: string;
  color: string;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  memberCount: number;
  guests: { id: number; displayName: string }[];
  alreadyMember: boolean;
  suggestedName: string;
}

export interface GroupExpenseShare {
  id: number;
  memberId: number;
  amount: number | null;
  baseAmount: number | null;
  tickSettlementId: number | null;
}

export interface GroupExpense {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  title: string;
  pending: boolean;
  amount: number | null;
  currency: string;
  exchangeRate: number;
  rateIsManual: boolean;
  rateSource: RateSource;
  baseAmount: number | null;
  date: string;
  category: GroupExpenseCategory;
  splitType: SplitType;
  paidByMemberId: number;
  createdByMemberId: number;
  updatedByMemberId: number | null;
  note: string | null;
  version: number;
  shares: GroupExpenseShare[];
  detachedTicks: number;
}

export interface GroupSettlement {
  id: number;
  createdAt: string;
  fromMemberId: number;
  toMemberId: number;
  amount: number;
  currency: string;
  exchangeRate: number;
  baseAmount: number;
  date: string;
  note: string | null;
  shareId: number | null;
  createdByMemberId: number;
}

export interface GroupBalanceMember {
  memberId: number;
  paid: number;
  share: number;
  net: number;
}

export interface GroupBalances {
  currency: string;
  simplified: boolean;
  myMemberId: number;
  myNet: number;
  total: number;
  myShare: number;
  myPaid: number;
  pendingCount: number;
  expenseCount: number;
  members: GroupBalanceMember[];
  suggested: { fromMemberId: number; toMemberId: number; amount: number }[];
  withMe: { memberId: number; amount: number }[];
}

export interface GroupStats {
  currency: string;
  total: number;
  myShare: number;
  myPaid: number;
  perDay: number;
  dayCount: number;
  pendingCount: number;
  expenseCount: number;
  granularity: 'DAY' | 'MONTH';
  byCategory: { category: GroupExpenseCategory; amount: number; count: number }[];
  byMember: GroupBalanceMember[];
  byPeriod: { period: string; amount: number }[];
}

export interface RateQuote {
  from: string;
  to: string;
  date: string;
  rate: number;
  source: RateSource;
  fetchedAt: string | null;
}

export interface GroupRequest {
  name?: string;
  icon?: string;
  color?: string;
  baseCurrency?: string;
  startDate?: string;
  endDate?: string;
  simplifyDebts?: boolean;
  archived?: boolean;
  guestNames?: string[];
}

export interface GroupExpenseRequest {
  clientId?: string;
  version?: number;
  title: string;
  pending: boolean;
  amount?: number;
  currency: string;
  exchangeRate?: number;
  date: string;
  category: GroupExpenseCategory;
  splitType: SplitType;
  paidByMemberId: number;
  shares: { memberId: number; amount?: number }[];
  note?: string;
}

export interface GroupSettlementRequest {
  clientId?: string;
  shareId?: number;
  fromMemberId?: number;
  toMemberId?: number;
  amount?: number;
  currency?: string;
  date?: string;
  note?: string;
}

export interface GroupMeRequest {
  displayName?: string;
  sync?: {
    enabled: boolean;
    categoryId?: number;
    paymentMethodId?: number;
    keepRecords?: boolean;
  };
}
