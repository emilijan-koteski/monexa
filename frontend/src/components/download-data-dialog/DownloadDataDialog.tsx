import './download-data-dialog.scss';
import { useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useTranslation } from 'react-i18next';

interface DownloadDataDialogProps {
  open: boolean;
  onClose: () => void;
  onDownload: (startDate: Date | null, endDate: Date | null) => void;
  isLoading?: boolean;
}

function DownloadDataDialog({
  open,
  onClose,
  onDownload,
  isLoading = false,
}: DownloadDataDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const handleClose = () => {
    if (!isLoading) {
      setStartDate(null);
      setEndDate(null);
      onClose();
    }
  };

  const handleDownload = () => {
    onDownload(startDate, endDate);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      id="download-data-dialog"
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>{t('DOWNLOAD_DATA_TITLE')}</DialogTitle>

      <DialogContent className="dialog-content">
        <DialogContentText>{t('DOWNLOAD_DATA_MESSAGE')}</DialogContentText>

        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} className="date-pickers">
          <DatePicker
            label={t('START_DATE')}
            value={startDate}
            onChange={(date) => setStartDate(date)}
            slotProps={{ textField: { size: 'small', fullWidth: true }, field: { clearable: true } }}
          />
          <DatePicker
            label={t('END_DATE')}
            value={endDate}
            onChange={(date) => setEndDate(date)}
            slotProps={{ textField: { size: 'small', fullWidth: true }, field: { clearable: true } }}
          />
        </Stack>
      </DialogContent>

      <DialogActions className="dialog-actions">
        <Button onClick={handleClose} disabled={isLoading} className="cancel-button">
          {t('CANCEL')}
        </Button>
        <Button
          onClick={handleDownload}
          variant="contained"
          color="primary"
          disabled={isLoading}
          className="download-button"
        >
          {isLoading ? <CircularProgress size={24} /> : t('DOWNLOAD')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DownloadDataDialog;
