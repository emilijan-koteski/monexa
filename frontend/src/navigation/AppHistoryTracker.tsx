import { useEffect, useRef } from 'react';
import { NavigationType, useLocation, useNavigate, useNavigationType } from 'react-router';
import { clearTraversal, currentIndex, isDialogOpen, markTraversal, recordEntry, type DialogHistoryState } from './appHistory';

/** Keeps the app's history stack in step with the router and steps over entries left by dialogs that already closed. */
function AppHistoryTracker() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const handledKey = useRef<string | null>(null);
  const previousIndex = useRef<number | null>(null);

  useEffect(() => {
    if (handledKey.current === location.key) {
      return;
    }
    handledKey.current = location.key;
    const index = currentIndex();
    const cameFrom = previousIndex.current;
    previousIndex.current = index;
    recordEntry(index, location.pathname, navigationType === NavigationType.Push);
    clearTraversal();

    const dialogs = (location.state as DialogHistoryState | null)?.dialogs ?? [];
    const staleDialogEntry = dialogs.length > 0 && dialogs.every((token) => !isDialogOpen(token));
    if (navigationType === NavigationType.Pop && staleDialogEntry) {
      markTraversal();
      navigate(cameFrom !== null && index > cameFrom ? 1 : -1);
    }
  }, [location, navigationType, navigate]);

  return null;
}

export default AppHistoryTracker;
