import './download-data-dialog.scss';
import { useMemo, useState } from 'react';
import { Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, FormControlLabel, Radio, RadioGroup, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useTranslation } from 'react-i18next';
import { DownloadDataDialogMode } from '../../enums/DownloadDataDialogMode';
import { ExportFormat } from '../../enums/ExportFormat';
import { ALL_EXPORT_CATEGORIES, ExportCategory, type ExportCategoryType } from '../../enums/ExportCategory';
import { ENV } from '../../config/env';

export interface DownloadDataParams {
  format: ExportFormat;
  categories: ExportCategoryType[];
  startDate: Date | null;
  endDate: Date | null;
}

interface DownloadDataDialogProps {
  open: boolean;
  onClose: () => void;
  onDownload: (params: DownloadDataParams) => void;
  isLoading?: boolean;
  mode?: DownloadDataDialogMode;
}

function DownloadDataDialog({
  open,
  onClose,
  onDownload,
  isLoading = false,
  mode = DownloadDataDialogMode.FULL,
}: DownloadDataDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const availableCategories = useMemo(() => {
    if (!ENV.LEGAL_COMPLIANCE_ENABLED) {
      return ALL_EXPORT_CATEGORIES.filter((c) => c !== ExportCategory.CONSENT);
    }
    return ALL_EXPORT_CATEGORIES;
  }, []);

  const [selectedCategories, setSelectedCategories] = useState<Set<ExportCategoryType>>(
    new Set(availableCategories)
  );
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.CSV);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const allSelected = availableCategories.every((c) => selectedCategories.has(c));

  const handleClose = () => {
    if (!isLoading) {
      setSelectedCategories(new Set(availableCategories));
      setFormat(ExportFormat.CSV);
      setStartDate(null);
      setEndDate(null);
      onClose();
    }
  };

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(availableCategories));
      setStartDate(null);
      setEndDate(null);
    }
  };

  const handleToggleCategory = (category: ExportCategoryType) => {
    const next = new Set(selectedCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setSelectedCategories(next);
  };

  const handleDownload = () => {
    const categories = mode === DownloadDataDialogMode.ALL_DATA
      ? availableCategories
      : Array.from(selectedCategories);

    onDownload({
      format,
      categories,
      startDate: allSelected || mode === DownloadDataDialogMode.ALL_DATA ? null : startDate,
      endDate: allSelected || mode === DownloadDataDialogMode.ALL_DATA ? null : endDate,
    });
  };

  const showDatePickers =
    mode === DownloadDataDialogMode.FULL &&
    !allSelected &&
    selectedCategories.has(ExportCategory.RECORDS);

  const isDownloadDisabled =
    isLoading || (mode === DownloadDataDialogMode.FULL && selectedCategories.size === 0);

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
        {mode === DownloadDataDialogMode.ALL_DATA ? (
          <DialogContentText>{t('DOWNLOAD_ALL_DATA_MESSAGE')}</DialogContentText>
        ) : (
          <>
            <DialogContentText>{t('DOWNLOAD_DATA_MESSAGE')}</DialogContentText>

            <Stack className="category-section">
              <Typography variant="subtitle2" color="text.secondary" className="section-label">
                {t('DATA_TO_INCLUDE')}
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={allSelected}
                    indeterminate={!allSelected && selectedCategories.size > 0}
                    onChange={handleToggleAll}
                  />
                }
                label={t('ALL_DATA')}
                className="category-checkbox all-data-checkbox"
              />

              <Divider className="all-data-divider" />

              {availableCategories.map((category) => (
                <Stack key={category}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedCategories.has(category)}
                        onChange={() => handleToggleCategory(category)}
                      />
                    }
                    label={t(category)}
                    className="category-checkbox"
                  />

                  {category === ExportCategory.RECORDS && showDatePickers && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} className="date-pickers">
                      <DatePicker
                        label={t('START_DATE')}
                        value={startDate}
                        onChange={(date) => setStartDate(date)}
                        slotProps={{
                          textField: { size: 'small', fullWidth: true },
                          field: { clearable: true },
                        }}
                      />
                      <DatePicker
                        label={t('END_DATE')}
                        value={endDate}
                        onChange={(date) => setEndDate(date)}
                        slotProps={{
                          textField: { size: 'small', fullWidth: true },
                          field: { clearable: true },
                        }}
                      />
                    </Stack>
                  )}
                </Stack>
              ))}
            </Stack>
          </>
        )}

        <Stack className="format-section">
          <Typography variant="subtitle2" color="text.secondary" className="section-label">
            {t('EXPORT_FORMAT')}
          </Typography>
          <RadioGroup
            row
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
          >
            <FormControlLabel
              value={ExportFormat.CSV}
              control={<Radio />}
              label={t('EXPORT_FORMAT_CSV')}
            />
            <FormControlLabel
              value={ExportFormat.JSON}
              control={<Radio />}
              label={t('EXPORT_FORMAT_JSON')}
            />
          </RadioGroup>
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
          disabled={isDownloadDisabled}
          className="download-button"
        >
          {isLoading ? <CircularProgress size={24} /> : t('DOWNLOAD')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DownloadDataDialog;
