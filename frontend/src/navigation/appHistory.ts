import type { NavigateFunction } from 'react-router';
import { tokenUtils } from '../utils/tokenUtils';

export const HOME_PATH = '/home';

const SECTION_PATHS = ['/groups', '/categories', '/trends', '/settings', '/profile'];

interface RouterHistoryState {
  usr?: unknown;
  key?: string;
  idx?: number;
}

export interface DialogHistoryState {
  dialogs?: string[];
}

const entries: string[] = [];
const openDialogTokens = new Set<string>();
let traversalPending = false;

const newEntryKey = () => Math.random().toString(36).slice(2, 10);

const normalize = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

/** Returns the screen one level up from a path, or null for Home and for pages outside the app. */
export function parentOf(pathname: string): string | null {
  const path = normalize(pathname);
  if (SECTION_PATHS.includes(path)) {
    return HOME_PATH;
  }
  if (path.startsWith('/join/')) {
    return '/groups';
  }
  return SECTION_PATHS.find((section) => path.startsWith(`${section}/`)) ?? null;
}

/** Lists the screens above a path, starting with Home. */
export function ancestorsOf(pathname: string): string[] {
  const chain: string[] = [];
  for (let parent = parentOf(pathname); parent; parent = parentOf(parent)) {
    chain.unshift(parent);
  }
  return chain;
}

/** Position of the current entry in the app's browser history, as counted by the router. */
export function currentIndex(): number {
  const idx = (window.history.state as RouterHistoryState | null)?.idx;
  return typeof idx === 'number' ? idx : 0;
}

/** Remembers which path sits at a history position; a push drops everything that was above it. */
export function recordEntry(index: number, pathname: string, isPush: boolean): void {
  if (isPush) {
    entries.length = index;
  }
  entries[index] = normalize(pathname);
}

/** Finds the closest earlier history position that shows the given path. */
export function findEntryBelow(pathname: string): number | null {
  const target = normalize(pathname);
  for (let index = currentIndex() - 1; index >= 0; index--) {
    if (entries[index] === target) {
      return index;
    }
  }
  return null;
}

const TRAVERSAL_TIMEOUT_MS = 1500;
let traversalTimer: ReturnType<typeof setTimeout> | undefined;

export const markTraversal = (): void => {
  traversalPending = true;
  clearTimeout(traversalTimer);
  traversalTimer = setTimeout(() => {
    traversalPending = false;
  }, TRAVERSAL_TIMEOUT_MS);
};

export const clearTraversal = (): void => {
  traversalPending = false;
};

export const isTraversing = (): boolean => traversalPending;

export const registerDialog = (token: string): void => {
  openDialogTokens.add(token);
};

export const unregisterDialog = (token: string): void => {
  openDialogTokens.delete(token);
};

export const isDialogOpen = (token: string): boolean => openDialogTokens.has(token);

const queuedOpens: string[] = [];
const queuedCloses = new Set<string>();
let dialogFlushScheduled = false;
let dialogNavigate: NavigateFunction | null = null;

function currentUserState(): DialogHistoryState {
  const state = window.history.state as (RouterHistoryState & { usr?: DialogHistoryState | null }) | null;
  return state?.usr ?? {};
}

/** Queues a dialog opening or closing; changes made in the same moment become a single history step. */
export function queueDialogChange(navigate: NavigateFunction, change: { open?: string; close?: string }): void {
  dialogNavigate = navigate;
  if (change.open) {
    queuedOpens.push(change.open);
  }
  if (change.close) {
    queuedCloses.add(change.close);
  }
  if (!dialogFlushScheduled) {
    dialogFlushScheduled = true;
    queueMicrotask(flushDialogChanges);
  }
}

function flushDialogChanges(): void {
  dialogFlushScheduled = false;
  const opens = queuedOpens.splice(0).filter((token) => !queuedCloses.has(token));
  const closes = new Set(queuedCloses);
  queuedCloses.clear();
  const navigate = dialogNavigate;
  if (!navigate || traversalPending) {
    return;
  }
  const userState = currentUserState();
  const current = userState.dialogs ?? [];
  const remaining = current.filter((token) => !closes.has(token));
  const closingHere = current.length - remaining.length;
  const { pathname, search, hash } = window.location;

  if (opens.length > 0) {
    navigate({ pathname, search, hash }, { state: { ...userState, dialogs: [...remaining, ...opens] }, replace: closingHere > 0 });
    return;
  }
  if (closingHere === 0) {
    return;
  }
  let closingOnTop = 0;
  while (closingOnTop < current.length && closes.has(current[current.length - 1 - closingOnTop])) {
    closingOnTop += 1;
  }
  if (closingOnTop === closingHere) {
    markTraversal();
    navigate(-closingOnTop);
    return;
  }
  navigate({ pathname, search, hash }, { state: { ...userState, dialogs: remaining }, replace: true });
}

/** Rebuilds the history behind a page opened from a link, so back walks up to Home and then leaves the app. */
export function seedHistory(): void {
  const state = window.history.state as RouterHistoryState | null;
  if (typeof state?.idx === 'number' || !tokenUtils.isAuthenticated()) {
    return;
  }
  const { pathname, search, hash } = window.location;
  const chain = ancestorsOf(pathname);
  if (chain.length === 0) {
    return;
  }
  chain.forEach((path, index) => {
    const entry = { usr: null, key: newEntryKey(), idx: index };
    if (index === 0) {
      window.history.replaceState(entry, '', path);
    } else {
      window.history.pushState(entry, '', path);
    }
    entries[index] = path;
  });
  window.history.pushState({ usr: null, key: newEntryKey(), idx: chain.length }, '', pathname + search + hash);
  entries[chain.length] = normalize(pathname);
}
