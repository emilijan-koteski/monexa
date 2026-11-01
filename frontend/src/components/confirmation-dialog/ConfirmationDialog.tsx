import './confirmation-dialog.scss';
import {
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import AppDialog from '../app-dialog/AppDialog';
import { useTranslation } from 'react-i18next';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  messageParams?: Record<string, string>;
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
  messageParams,
  isLoading = false,
  confirmText,
  confirmColor = 'primary',
}: ConfirmationDialogProps) {
  const { t } = useTranslation();

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      id='confirmation-dialog'
      fullWidth
      maxWidth='sm'
    >
      <DialogTitle>{t(title)}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t(message, messageParams)}</DialogContentText>
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
    </AppDialog>
  );
}

export default ConfirmationDialog;
