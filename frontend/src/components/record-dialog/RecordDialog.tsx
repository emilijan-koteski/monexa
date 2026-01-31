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
  Chip,
  Skeleton,
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
import { useDescriptionSuggestions } from '../../services/recordService';
import { formatAmount, stripCommas } from '../../utils/amount';
import { truncateText } from '../../utils/string';
import { Currency } from '../../enums/Currency';

interface RecordDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RecordFormData) => void;
  record?: FinancialRecord | null;
  isLoading?: boolean;
  defaultDate?: Date;
}

export interface RecordFormData {
  categoryId: number;
  paymentMethodId: number;
  amount: number;
  currency: string;
  description?: string;
  date: Date;
}

interface RecordFormInput {
  categoryId: number;
  paymentMethodId: number;
  amount: string;
  currency: string;
  description?: string;
  date: Date;
}

const recordSchema = z.object({
  categoryId: z.number().min(1, 'CATEGORY_REQUIRED'),
  paymentMethodId: z.number().min(1, 'PAYMENT_METHOD_REQUIRED'),
  amount: z.string().refine(
    (val) => {
      const num = Number(val.replace(/,/g, ''));
      return !isNaN(num) && num >= 0.01;
    },
    { message: 'AMOUNT_MIN' },
  ),
  currency: z.string().min(1, 'CURRENCY_REQUIRED'),
  description: z.string().optional(),
  date: z.date(),
});

function RecordDialog({ open, onClose, onSubmit, record, isLoading = false, defaultDate }: RecordDialogProps) {
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
    watch,
    setValue,
    formState: { errors },
  } = useForm<RecordFormInput>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      categoryId: 0,
      paymentMethodId: 0,
      amount: '',
      currency: settings?.currency || Currency.MKD,
      description: '',
      date: defaultDate || new Date(),
    },
  });

  useEffect(() => {
    if (open) {
      if (record) {
        reset({
          categoryId: record.categoryId,
          paymentMethodId: record.paymentMethodId,
          amount: formatAmount(String(record.amount)),
          currency: record.currency,
          description: record.description || '',
          date: new Date(record.date),
        });
      } else {
        reset({
          categoryId: 0,
          paymentMethodId: 0,
          amount: '',
          currency: settings?.currency || Currency.MKD,
          description: '',
          date: defaultDate || new Date(),
        });
      }
    }
  }, [open, record, settings, reset, defaultDate]);

  const handleFormSubmit = (data: RecordFormInput) => {
    onSubmit({
      ...data,
      amount: Number(stripCommas(data.amount)),
    });
  };

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleAmountChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: { onChange: (value: string) => void },
  ) => {
    const raw = stripCommas(e.target.value);
    if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
      const cleaned = raw.replace(/^0+(\d)/, '$1');
      field.onChange(formatAmount(cleaned));
    }
  };

  const handleAmountBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: { onBlur: () => void; onChange: (value: string) => void },
  ) => {
    field.onBlur();
    const raw = stripCommas(e.target.value);
    if (raw.includes('.')) {
      const trimmed = raw.replace(/\.?0+$/, '');
      field.onChange(formatAmount(trimmed));
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const watchedCategoryId = watch('categoryId');
  const { data: suggestions, isLoading: suggestionsLoading } = useDescriptionSuggestions(watchedCategoryId);

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
                    label={t('AMOUNT')}
                    fullWidth
                    error={!!errors.amount}
                    helperText={errors.amount ? t(errors.amount.message || '') : ''}
                    className="form-field amount-field"
                    slotProps={{
                      htmlInput: {
                        inputMode: 'decimal',
                      },
                    }}
                    onFocus={handleAmountFocus}
                    onChange={(e) => handleAmountChange(e, field)}
                    onBlur={(e) => handleAmountBlur(e, field)}
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
                    {Object.values(Currency).map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
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

            {watchedCategoryId > 0 && (
              <Box className="description-suggestions">
                {suggestionsLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <Skeleton
                        key={i}
                        variant="rounded"
                        width={70 + i * 15}
                        height={24}
                        className="suggestion-skeleton"
                      />
                    ))}
                  </>
                ) : (
                  suggestions?.map((suggestion) => (
                    <Chip
                      key={suggestion}
                      label={truncateText(suggestion, 18)}
                      size="small"
                      variant="outlined"
                      onClick={() => setValue('description', suggestion)}
                      className="suggestion-chip"
                    />
                  ))
                )}
              </Box>
            )}
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
