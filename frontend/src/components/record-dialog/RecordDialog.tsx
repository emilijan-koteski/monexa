import './record-dialog.scss';
import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { FinancialRecord } from '../../types/models';
import { useCategories } from '../../services/categoryService';
import { usePaymentMethods } from '../../services/paymentMethodService';
import { useSettings } from '../../services/settingService';

interface RecordDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RecordFormData) => void;
  record?: FinancialRecord | null;
  isLoading?: boolean;
}

export interface RecordFormData {
  categoryId: number;
  paymentMethodId: number;
  amount: number;
  currency: string;
  description?: string;
  date: Date;
}

const recordSchema = z.object({
  categoryId: z.number().min(1, 'CATEGORY_REQUIRED'),
  paymentMethodId: z.number().min(1, 'PAYMENT_METHOD_REQUIRED'),
  amount: z.number().min(0.01, 'AMOUNT_MIN'),
  currency: z.string().min(1, 'CURRENCY_REQUIRED'),
  description: z.string().optional(),
  date: z.date(),
});

function RecordDialog({ open, onClose, onSubmit, record, isLoading = false }: RecordDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: paymentMethods, isLoading: paymentMethodsLoading } = usePaymentMethods();
  const { data: settings } = useSettings();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecordFormData>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      categoryId: 0,
      paymentMethodId: 0,
      amount: 0,
      currency: settings?.currency || 'USD',
      description: '',
      date: new Date(),
    },
  });

  useEffect(() => {
    if (open) {
      if (record) {
        reset({
          categoryId: record.categoryId,
          paymentMethodId: record.paymentMethodId,
          amount: Number(record.amount),
          currency: record.currency,
          description: record.description || '',
          date: new Date(record.date),
        });
      } else {
        reset({
          categoryId: 0,
          paymentMethodId: 0,
          amount: 0,
          currency: settings?.currency || 'USD',
          description: '',
          date: new Date(),
        });
      }
    }
  }, [open, record, settings, reset]);

  const handleFormSubmit = (data: RecordFormData) => {
    onSubmit(data);
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const isDataLoading = categoriesLoading || paymentMethodsLoading;

  return (
    <Dialog open={open} onClose={handleClose} id="record-dialog" maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>{record ? t('EDIT_RECORD') : t('NEW_RECORD')}</DialogTitle>

      <DialogContent>
        {isDataLoading ? (
          <Box className="loading-container">
            <CircularProgress />
          </Box>
        ) : (
          <form id="record-form" onSubmit={handleSubmit(handleFormSubmit)}>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label={t('CATEGORY')}
                  fullWidth
                  error={!!errors.categoryId}
                  helperText={errors.categoryId ? t(errors.categoryId.message || '') : ''}
                  className="form-field"
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  value={field.value || ''}
                >
                  {categories?.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="paymentMethodId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label={t('PAYMENT_METHOD')}
                  fullWidth
                  error={!!errors.paymentMethodId}
                  helperText={
                    errors.paymentMethodId ? t(errors.paymentMethodId.message || '') : ''
                  }
                  className="form-field"
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  value={field.value || ''}
                >
                  {paymentMethods?.map((method) => (
                    <MenuItem key={method.id} value={method.id}>
                      {method.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Box className="amount-currency-row">
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label={t('AMOUNT')}
                    fullWidth
                    error={!!errors.amount}
                    helperText={errors.amount ? t(errors.amount.message || '') : ''}
                    className="form-field amount-field"
                    slotProps={{
                      htmlInput: {
                        step: '0.01',
                        min: '0',
                      },
                    }}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                )}
              />

              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label={t('CURRENCY')}
                    error={!!errors.currency}
                    helperText={errors.currency ? t(errors.currency.message || '') : ''}
                    className="form-field currency-field"
                  >
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="MKD">MKD</MenuItem>
                  </TextField>
                )}
              />
            </Box>

            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label={t('DATE')}
                  value={field.value}
                  onChange={(date) => field.onChange(date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.date,
                      helperText: errors.date ? t(errors.date.message || '') : '',
                      className: 'form-field',
                    },
                  }}
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('DESCRIPTION')}
                  fullWidth
                  multiline
                  rows={3}
                  error={!!errors.description}
                  helperText={errors.description ? t(errors.description.message || '') : ''}
                  className="form-field"
                  placeholder={t('DESCRIPTION_PLACEHOLDER')}
                />
              )}
            />
          </form>
        )}
      </DialogContent>

      <DialogActions className="dialog-actions">
        <Button onClick={handleClose} disabled={isLoading} className="cancel-button">
          {t('CANCEL')}
        </Button>
        <Button
          type="submit"
          form="record-form"
          variant="contained"
          color="primary"
          disabled={isLoading || isDataLoading}
          className="submit-button"
        >
          {isLoading ? <CircularProgress size={24} /> : record ? t('UPDATE') : t('CREATE')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RecordDialog;
