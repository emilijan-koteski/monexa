import './undo-toast.scss';
import { Box, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
}

function UndoToast({ message, onUndo }: UndoToastProps) {
  const { t } = useTranslation();
  return (
    <Box className="undo-toast" role="status">
      <span className="undo-toast-message">{message}</span>
      <Button size="small" onClick={onUndo} className="undo-toast-button">{t('GROUP_UNDO')}</Button>
    </Box>
  );
}

export default UndoToast;
