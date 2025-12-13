import './confirmation-dialog.scss';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading?: boolean;
  confirmText: string;
  confirmColor:
    | 'error'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'info'
    | 'warning';
}

function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  isLoading = false,
  confirmText,
  confirmColor = 'primary',
}: ConfirmationDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      id='confirmation-dialog'
      fullWidth
      maxWidth='sm'
    >
      <DialogTitle>{t(title)}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t(message)}</DialogContentText>
      </DialogContent>
      <DialogActions className='dialog-actions'>
        <Button
          onClick={onClose}
          disabled={isLoading}
          className='cancel-button'
        >
          {t('CANCEL')}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant='contained'
          disabled={isLoading}
          className='confirm-button'
        >
          {t(confirmText)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmationDialog;
