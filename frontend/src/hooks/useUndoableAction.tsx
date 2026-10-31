import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import UndoToast from '../components/undo-toast/UndoToast';

export interface UndoableAction {
  key: string;
  message: string;
  apply: () => void;
  revert: () => void;
  commit: () => Promise<unknown>;
  onError?: (error: unknown) => void;
}

const UNDO_WINDOW_MS = 5000;

/** Applies a change to the cache at once and sends it to the server only after the undo window, flushing pending changes when the page goes away. */
export function useUndoableAction() {
  const pending = useRef(new Map<string, () => void>());

  useEffect(() => {
    const queue = pending.current;
    const flush = () => {
      Array.from(queue.values()).forEach((run) => run());
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return useCallback((action: UndoableAction) => {
    const queue = pending.current;
    queue.get(action.key)?.();
    action.apply();

    let settled = false;
    let timer = 0;
    const run = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      queue.delete(action.key);
      action.commit().catch((error) => {
        action.revert();
        action.onError?.(error);
      });
    };
    const undo = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      queue.delete(action.key);
      action.revert();
      toast.dismiss(action.key);
    };

    timer = window.setTimeout(run, UNDO_WINDOW_MS);
    queue.set(action.key, run);
    toast(<UndoToast message={action.message} onUndo={undo} />, {
      toastId: action.key,
      autoClose: UNDO_WINDOW_MS,
      closeOnClick: false,
    });
  }, []);
}
