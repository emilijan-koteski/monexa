import { useSyncExternalStore } from 'react';
import type { User } from '../types/models';
import { tokenUtils } from '../utils/tokenUtils';

let cachedSnapshot: User | null = tokenUtils.getUser();

function subscribe(callback: () => void) {
  const handler = () => {
    cachedSnapshot = tokenUtils.getUser();
    callback();
  };
  window.addEventListener('user-updated', handler);
  return () => window.removeEventListener('user-updated', handler);
}

function getSnapshot(): User | null {
  return cachedSnapshot;
}

export const useUser = (): User | null => {
  return useSyncExternalStore(subscribe, getSnapshot);
};
