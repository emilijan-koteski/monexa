import { useEffect, useState, type FormEvent } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { formatInviteInput } from '../../utils/groups';

interface JoinCodeDialogProps {
  open: boolean;
  onClose: () => void;
}

const CODE_LENGTH = 9;

function JoinCodeDialog({ open, onClose }: JoinCodeDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  useEffect(() => {
    if (open) {
      setCode('');
    }
  }, [open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length === CODE_LENGTH) {
      navigate(`/join/${code}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth id="join-code-dialog">
      <DialogTitle>{t('GROUP_JOIN_WITH_CODE')}</DialogTitle>
      <DialogContent>
        <form id="join-code-form" onSubmit={submit}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('GROUP_JOIN_CODE_HINT')}</Typography>
          <TextField
            value={code}
            onChange={(event) => setCode(formatInviteInput(event.target.value))}
            label={t('GROUP_INVITE_CODE')}
            placeholder="XXXX-XXXX"
            fullWidth
            autoFocus
            slotProps={{ htmlInput: { autoComplete: 'off', autoCapitalize: 'characters', style: { letterSpacing: '0.2em', fontSize: '1.4rem', textAlign: 'center' } } }}
          />
        </form>
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button onClick={onClose}>{t('CANCEL')}</Button>
        <Button type="submit" form="join-code-form" variant="contained" disabled={code.length !== CODE_LENGTH}>{t('GROUP_CONTINUE')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default JoinCodeDialog;
