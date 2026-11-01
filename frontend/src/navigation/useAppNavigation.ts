import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { HOME_PATH, currentIndex, findEntryBelow, markTraversal } from './appHistory';

/** Back navigation that matches the phone's back gesture: one screen back while there is one, else the given parent. */
export function useAppNavigation() {
  const navigate = useNavigate();

  const goBack = useCallback((fallback: string) => {
    if (currentIndex() > 0) {
      markTraversal();
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate]);

  const goBackTo = useCallback((path: string) => {
    const target = findEntryBelow(path);
    if (target === null) {
      navigate(path, { replace: true });
      return;
    }
    markTraversal();
    navigate(target - currentIndex());
  }, [navigate]);

  const goHome = useCallback(() => goBackTo(HOME_PATH), [goBackTo]);

  return { goBack, goBackTo, goHome };
}
