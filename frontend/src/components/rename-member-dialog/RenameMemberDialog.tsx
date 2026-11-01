import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import AppDialog from '../app-dialog/AppDialog';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { GroupMember } from '../../types/groups';
import { useUpdateMember } from '../../services/groupService';
import { groupErrorMessage } from '../../utils/groupErrors';

const MAX_NAME_LENGTH = 40;

interface RenameMemberDialogProps {
  groupId: number;
  member: GroupMember | null;
  onClose: () => void;
}

function RenameMemberDialog({ groupId, member, onClose }: RenameMemberDialogProps) {
  const { t } = useTranslation();
  const updateMember = useUpdateMember();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (member) {
      setName(member.displayName);
      setError(null);
    }
  }, [member]);

  const trimmed = name.trim();
  const canSave = !!member && trimmed !== '' && trimmed !== member.displayName && !updateMember.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!member || !canSave) {
      return;
    }
    try {
      await updateMember.mutateAsync({ groupId, memberId: member.id, displayName: trimmed });
      toast.success(t('GROUP_PERSON_RENAMED'));
      onClose();
    } catch (requestError) {
      setError(groupErrorMessage(requestError, t, 'GROUP_ACTION_ERROR'));
    }
  };

  return (
    <AppDialog
      open={!!member}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      id="rename-member-dialog"
      slotProps={{ transition: { onEntered: () => inputRef.current?.select() } }}
    >
      <DialogTitle>{t('GROUP_RENAME_TITLE', { name: member?.displayName ?? '' })}</DialogTitle>
      <DialogContent>
        <form id="rename-member-form" onSubmit={submit}>
          <TextField
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            label={t('GROUP_PERSON_NAME')}
            error={!!error}
            helperText={error}
            fullWidth
            inputRef={inputRef}
            margin="dense"
            slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH, autoComplete: 'off' } }}
          />
        </form>
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button onClick={onClose}>{t('CANCEL')}</Button>
        <Button type="submit" form="rename-member-form" variant="contained" disabled={!canSave}>{t('GROUP_SAVE')}</Button>
      </DialogActions>
    </AppDialog>
  );
}

export default RenameMemberDialog;
