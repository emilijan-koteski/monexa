import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { queueDialogChange, registerDialog, unregisterDialog, type DialogHistoryState } from './appHistory';

interface OwnedEntry {
  token: string | null;
  landed: boolean;
}

let openSequence = 0;

/** Gives an open dialog its own history entry, so the phone's back gesture closes the dialog instead of leaving the page. */
export function useBackToClose(open: boolean, onClose: () => void): void {
  const navigate = useNavigate();
  const location = useLocation();
  const baseId = useId();
  const [owned] = useState<OwnedEntry>(() => ({ token: null, landed: false }));
  const [retry, setRetry] = useState(0);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (owned.token !== null) {
      registerDialog(owned.token);
    }
    return () => {
      if (owned.token !== null) {
        unregisterDialog(owned.token);
      }
    };
  }, [owned]);

  useEffect(() => {
    const dialogs = (location.state as DialogHistoryState | null)?.dialogs ?? [];
    if (owned.token !== null) {
      if (dialogs.includes(owned.token)) {
        owned.landed = true;
      } else if (owned.landed) {
        unregisterDialog(owned.token);
        owned.token = null;
        owned.landed = false;
        if (open) {
          closeRef.current();
          setRetry((count) => count + 1);
        }
        return;
      }
    }

    if (open && owned.token === null) {
      openSequence += 1;
      owned.token = `${baseId}${openSequence}`;
      owned.landed = false;
      registerDialog(owned.token);
      queueDialogChange(navigate, { open: owned.token });
      return;
    }

    if (!open && owned.token !== null) {
      const token = owned.token;
      owned.token = null;
      owned.landed = false;
      unregisterDialog(token);
      queueDialogChange(navigate, { close: token });
    }
  }, [location, open, owned, baseId, navigate, retry]);
}
