import {
  faBagShopping,
  faBed,
  faBox,
  faBriefcase,
  faCar,
  faCartShopping,
  faCity,
  faGift,
  faHeart,
  faHouse,
  faMountain,
  faMugHot,
  faPlane,
  faShip,
  faSun,
  faTent,
  faTicket,
  faUtensils,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { format } from 'date-fns';
import { enGB, mk } from 'date-fns/locale';
import { GroupExpenseCategory } from '../enums/GroupExpenseCategory';
import type { GroupBalances, GroupMember, GroupTransfer } from '../types/groups';
import { stripCommas } from './amount';

export const GROUP_ICONS: Record<string, IconDefinition> = {
  city: faCity,
  plane: faPlane,
  mountain: faMountain,
  sun: faSun,
  home: faHouse,
  utensils: faUtensils,
  car: faCar,
  tent: faTent,
  gift: faGift,
  briefcase: faBriefcase,
  heart: faHeart,
  ship: faShip,
};

export const GROUP_ICON_KEYS = Object.keys(GROUP_ICONS);

export const GROUP_COLORS = ['#ff7aa8', '#8f92ff', '#55ead4', '#ffb35c', '#93e700', '#c3a6ff'];

export const groupIcon = (key: string): IconDefinition => GROUP_ICONS[key] ?? faCity;

export interface CategoryMeta {
  icon: IconDefinition;
  color: string;
  labelKey: string;
}

export const CATEGORY_META: Record<GroupExpenseCategory, CategoryMeta> = {
  [GroupExpenseCategory.FOOD]: { icon: faUtensils, color: '#ff7aa8', labelKey: 'GROUP_CATEGORY_FOOD' },
  [GroupExpenseCategory.GROCERIES]: { icon: faCartShopping, color: '#55ead4', labelKey: 'GROUP_CATEGORY_GROCERIES' },
  [GroupExpenseCategory.DRINKS]: { icon: faMugHot, color: '#ffb35c', labelKey: 'GROUP_CATEGORY_DRINKS' },
  [GroupExpenseCategory.TRANSPORT]: { icon: faCar, color: '#8f92ff', labelKey: 'GROUP_CATEGORY_TRANSPORT' },
  [GroupExpenseCategory.ACCOMMODATION]: { icon: faBed, color: '#c3a6ff', labelKey: 'GROUP_CATEGORY_ACCOMMODATION' },
  [GroupExpenseCategory.ACTIVITIES]: { icon: faTicket, color: '#93e700', labelKey: 'GROUP_CATEGORY_ACTIVITIES' },
  [GroupExpenseCategory.SHOPPING]: { icon: faBagShopping, color: '#f3e600', labelKey: 'GROUP_CATEGORY_SHOPPING' },
  [GroupExpenseCategory.OTHER]: { icon: faBox, color: '#a8abdc', labelKey: 'GROUP_CATEGORY_OTHER' },
};

export const GROUP_CATEGORIES = Object.values(GroupExpenseCategory);

const CATEGORY_KEYWORDS: [GroupExpenseCategory, string[]][] = [
  [GroupExpenseCategory.TRANSPORT, ['fuel', 'petrol', 'diesel', 'toll', 'parking', 'taxi', 'uber', 'bolt', 'bus', 'train', 'flight', 'metro', 'gorivo', 'benzin', 'patarin', 'гориво', 'бензин', 'патарин', 'паркинг', 'такси', 'автобус', 'воз ', 'лет ']],
  [GroupExpenseCategory.FOOD, ['lunch', 'dinner', 'breakfast', 'food', 'restaurant', 'pizza', 'burger', 'meal', 'rucek', 'ručak', 'vecera', 'večera', 'dorucek', 'doruchek', 'jadenje', 'hrana', 'ручек', 'вечера', 'доручек', 'јадење', 'храна', 'ресторан']],
  [GroupExpenseCategory.DRINKS, ['coffee', 'kafe', 'kafa', 'beer', 'pivo', 'wine', 'vino', 'drink', 'juice', 'chocolate', 'chokolat', 'кафе', 'пиво', 'вино', 'пијал', 'чоколад']],
  [GroupExpenseCategory.GROCERIES, ['grocer', 'market', 'water', 'vodi', 'voda', 'вода', 'води', 'маркет', 'намирници']],
  [GroupExpenseCategory.ACCOMMODATION, ['hotel', 'hostel', 'airbnb', 'apartment', 'apartman', 'smestuvanje', 'сместување', 'хотел', 'апартман']],
  [GroupExpenseCategory.ACTIVITIES, ['ticket', 'museum', 'tour', 'concert', 'cinema', 'spa', 'thermal', 'bath', 'bilet', 'karta', 'музеј', 'концерт', 'кино', 'тура', 'билет']],
  [GroupExpenseCategory.SHOPPING, ['shopping', 'souvenir', 'clothes', 'gift', 'suvenir', 'подарок', 'сувенир', 'облека']],
];

/** Guesses a category from what a title mentions first, so "Water for apartment" lands in groceries. */
export function guessCategory(title: string): GroupExpenseCategory | null {
  const text = ` ${title.toLowerCase()} `;
  let best: { category: GroupExpenseCategory; position: number } | null = null;
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      const position = text.indexOf(keyword);
      if (position >= 0 && (!best || position < best.position)) {
        best = { category, position };
      }
    }
  }
  return best?.category ?? null;
}

export const ME_COLOR = '#8f92ff';
export const MEMBER_COLORS = ['#ff7aa8', '#55ead4', '#ffb35c', '#93e700', '#c3a6ff'];

export const memberColor = (member: Pick<GroupMember, 'id' | 'isMe'>): string =>
  member.isMe ? ME_COLOR : MEMBER_COLORS[member.id % MEMBER_COLORS.length];

export const memberInitial = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

export const toCents = (value: number): number => Math.round(value * 100);
export const fromCents = (cents: number): number => cents / 100;

/** Splits cents across weights with the largest remainder, giving leftover cents to earlier rows, like the backend. */
export function allocateCents(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + (w > 0 ? w : 0), 0);
  if (total <= 0 || sum === 0) {
    return weights.map(() => 0);
  }
  const raw = weights.map((w) => (w > 0 ? (total * w) / sum : 0));
  const parts = raw.map((r) => Math.floor(r));
  const remainder = total - parts.reduce((acc, p) => acc + p, 0);
  const order = raw
    .map((r, i) => ({ i, fraction: r - Math.floor(r), weight: weights[i] }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (let k = 0; k < remainder; k++) {
    parts[order[k % order.length].i] += 1;
  }
  return parts;
}

/** Reads a formatted amount like "1,250.50" into cents; blank or invalid text gives null. */
export function parseAmountCents(value: string): number | null {
  const raw = stripCommas(value ?? '').trim();
  if (raw === '') {
    return null;
  }
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? toCents(amount) : null;
}

export const toApiDay = (date: Date): string => format(date, 'yyyy-MM-dd');

/** Turns an API date (stored as 12:00 UTC) into a local Date on the same calendar day. */
export function fromApiDay(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const newClientId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r % 4) + 8).toString(16);
    });

export const LAST_CURRENCY_KEY_PREFIX = 'groupLastCurrency:';

export function readLastCurrency(groupId: number): string | null {
  try {
    return localStorage.getItem(`${LAST_CURRENCY_KEY_PREFIX}${groupId}`);
  } catch {
    return null;
  }
}

export function rememberCurrency(groupId: number, currency: string): void {
  try {
    localStorage.setItem(`${LAST_CURRENCY_KEY_PREFIX}${groupId}`, currency);
  } catch {
    return;
  }
}

export const dateLocale = (language: string) => (language === 'MK' ? mk : enGB);

/** Formats a trip's dates compactly, e.g. "12 – 15 Oct" or "28 Oct – 2 Nov 2026" across years. */
export function formatDateRange(start: string | null, end: string | null, language: string): string | null {
  if (!start && !end) {
    return null;
  }
  const locale = dateLocale(language);
  const from = start ? fromApiDay(start) : null;
  const to = end ? fromApiDay(end) : null;
  if (from && to) {
    const sameYear = from.getFullYear() === to.getFullYear();
    if (sameYear && from.getMonth() === to.getMonth()) {
      return `${format(from, 'd', { locale })} – ${format(to, 'd MMM', { locale })}`;
    }
    return sameYear
      ? `${format(from, 'd MMM', { locale })} – ${format(to, 'd MMM', { locale })}`
      : `${format(from, 'd MMM yyyy', { locale })} – ${format(to, 'd MMM yyyy', { locale })}`;
  }
  return format((from ?? to) as Date, 'd MMM yyyy', { locale });
}

export const inviteLink = (code: string): string => `${window.location.origin}/join/${code}`;

export function formatInviteInput(value: string): string {
  const raw = value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export interface SimplifyCover {
  payerId: number;
  creditorId: number;
  amount: number;
}

export interface SimplifyExplanation {
  owedToMe: number;
  iOwe: number;
  net: number;
  covers: SimplifyCover[];
}

const transferKey = (from: number, to: number) => `${from}-${to}`;

const transferCents = (transfers: GroupTransfer[]): Map<string, number> =>
  new Map(transfers.map((transfer) => [transferKey(transfer.fromMemberId, transfer.toMemberId), toCents(transfer.amount)]));

/** Reports whether simplifying changed who pays whom compared with paying each person back directly. */
export function simplifyChangesPayments(balances: GroupBalances): boolean {
  if (!balances.simplified) {
    return false;
  }
  const direct = transferCents(balances.direct);
  const suggested = transferCents(balances.suggested);
  return direct.size !== suggested.size || [...direct].some(([key, cents]) => suggested.get(key) !== cents);
}

/** Explains the caller's simplified payments: what they are owed and owe directly, and which simplified payment covers their debts. */
export function explainSimplified(balances: GroupBalances): SimplifyExplanation | null {
  const me = balances.myMemberId;
  const owedToMe = balances.withMe.filter((pair) => pair.amount > 0);
  const iOwe = balances.withMe.filter((pair) => pair.amount < 0);
  if (!balances.simplified || owedToMe.length === 0 || iOwe.length === 0) {
    return null;
  }
  const suggested = transferCents(balances.suggested);
  const sent = (from: number, to: number) => suggested.get(transferKey(from, to)) ?? 0;
  const redirected = owedToMe
    .map((pair) => ({ id: pair.memberId, cents: toCents(pair.amount) - sent(pair.memberId, me) }))
    .filter((entry) => entry.cents > 0);
  const capacity = new Map(suggested);
  const covers: SimplifyCover[] = [];
  for (const pair of iOwe) {
    let need = toCents(-pair.amount) - sent(me, pair.memberId);
    for (const payer of redirected) {
      const key = transferKey(payer.id, pair.memberId);
      const take = Math.min(need, payer.cents, capacity.get(key) ?? 0);
      if (take > 0) {
        covers.push({ payerId: payer.id, creditorId: pair.memberId, amount: fromCents(take) });
        need -= take;
        payer.cents -= take;
        capacity.set(key, (capacity.get(key) ?? 0) - take);
      }
    }
  }
  const inCents = owedToMe.reduce((sum, pair) => sum + toCents(pair.amount), 0);
  const outCents = iOwe.reduce((sum, pair) => sum + toCents(-pair.amount), 0);
  return { owedToMe: fromCents(inCents), iOwe: fromCents(outCents), net: fromCents(inCents - outCents), covers };
}
