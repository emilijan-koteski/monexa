import './recurring-expense-dialog.scss';
import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Autocomplete, MenuItem, Box, CircularProgress, Typography, useMediaQuery, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { startOfDay } from 'date-fns';
import type { RecurringExpense } from '../../types/models';
import { useCategories, useCreateCategory } from '../../services/categoryService';
import { usePaymentMethods, useCreatePaymentMethod } from '../../services/paymentMethodService';
import { useSettings } from '../../services/settingService';
import { formatAmount, stripCommas } from '../../utils/amount';
import { Currency } from '../../enums/Currency';
import { RecurrenceFrequency } from '../../enums/RecurrenceFrequency';
import CategoryDialog from '../category-dialog/CategoryDialog';
import type { CategoryFormData } from '../category-dialog/CategoryDialog';
import PaymentTypeDialog from '../payment-type-dialog/PaymentTypeDialog';
import type { PaymentTypeFormData } from '../payment-type-dialog/PaymentTypeDialog';

interface RecurringExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RecurringExpenseFormData) => void;
  recurringExpense?: RecurringExpense | null;
  isLoading?: boolean;
}

export interface RecurringExpenseFormData {
  categoryId: number;
  paymentMethodId: number;
  amount: number;
  currency: string;
  frequency: RecurrenceFrequency;
  startDate: Date;
  endDate?: Date | null;
  description?: string;
}

interface RecurringExpenseFormInput {
  categoryId: number;
  paymentMethodId: number;
  amount: string;
  currency: string;
  frequency: RecurrenceFrequency;
  startDate: Date;
  endDate?: Date | null;
  description?: string;
}

const recurringExpenseSchema = z
  .object({
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
    frequency: z.enum(
      [RecurrenceFrequency.DAILY, RecurrenceFrequency.WEEKLY, RecurrenceFrequency.MONTHLY, RecurrenceFrequency.YEARLY],
      { message: 'FREQUENCY_REQUIRED' },
    ),
    startDate: z.date(),
    endDate: z.date().nullable().optional(),
    description: z.string().optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: 'END_DATE_BEFORE_START',
    path: ['endDate'],
  });

function RecurringExpenseDialog({ open, onClose, onSubmit, recurringExpense, isLoading = false }: RecurringExpenseDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: paymentMethods, isLoading: paymentMethodsLoading } = usePaymentMethods();
  const { data: settings } = useSettings();

  const today = startOfDay(new Date());

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RecurringExpenseFormInput>({
    resolver: zodResolver(recurringExpenseSchema),
    defaultValues: {
      categoryId: 0,
      paymentMethodId: 0,
      amount: '',
      currency: settings?.currency || Currency.MKD,
      frequency: RecurrenceFrequency.MONTHLY,
      startDate: today,
      endDate: null,
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (recurringExpense) {
        reset({
          categoryId: recurringExpense.categoryId,
          paymentMethodId: recurringExpense.paymentMethodId,
          amount: formatAmount(String(recurringExpense.amount)),
          currency: recurringExpense.currency,
          frequency: recurringExpense.frequency,
          startDate: new Date(recurringExpense.startDate),
          endDate: recurringExpense.endDate ? new Date(recurringExpense.endDate) : null,
          description: recurringExpense.description || '',
        });
      } else {
        reset({
          categoryId: 0,
          paymentMethodId: 0,
          amount: '',
          currency: settings?.currency || Currency.MKD,
          frequency: RecurrenceFrequency.MONTHLY,
          startDate: startOfDay(new Date()),
          endDate: null,
          description: '',
        });
      }
    }
  }, [open, recurringExpense, settings, reset]);

  const handleFormSubmit = (data: RecurringExpenseFormInput) => {
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

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [paymentMethodDialogOpen, setPaymentMethodDialogOpen] = useState(false);

  const createCategoryMutation = useCreateCategory();
  const createPaymentMethodMutation = useCreatePaymentMethod();

  const handleCategoryCreate = async (data: CategoryFormData) => {
    try {
      const newCategory = await createCategoryMutation.mutateAsync(data);
      setValue('categoryId', newCategory.id);
      setCategoryDialogOpen(false);
      toast.success(t('QUICK_CATEGORY_CREATED'));
    } catch {
      toast.error(t('QUICK_CATEGORY_CREATE_ERROR'));
    }
  };

  const handlePaymentMethodCreate = async (data: PaymentTypeFormData) => {
    try {
      const newMethod = await createPaymentMethodMutation.mutateAsync(data);
      setValue('paymentMethodId', newMethod.id);
      setPaymentMethodDialogOpen(false);
      toast.success(t('QUICK_PAYMENT_METHOD_CREATED'));
    } catch {
      toast.error(t('QUICK_PAYMENT_METHOD_CREATE_ERROR'));
    }
  };

  const startDateValue = watch('startDate');
  const isDataLoading = categoriesLoading || paymentMethodsLoading;

  return (
    <Dialog open={open} onClose={handleClose} id="recurring-expense-dialog" maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>{recurringExpense ? t('EDIT_RECURRING_EXPENSE') : t('NEW_RECURRING_EXPENSE')}</DialogTitle>

      <DialogContent>
        {isDataLoading ? (
          <Box className="loading-container">
            <CircularProgress />
          </Box>
        ) : (
          <form id="recurring-expense-form" onSubmit={handleSubmit(handleFormSubmit)}>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  options={categories || []}
                  getOptionLabel={(option) => option.name}
                  value={categories?.find((c) => c.id === field.value) || null}
                  onChange={(_, newValue) => field.onChange(newValue ? newValue.id : 0)}
                  fullWidth
                  className="form-field"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('CATEGORY')}
                      error={!!errors.categoryId}
                      helperText={errors.categoryId ? t(errors.categoryId.message || '') : ''}
                    />
                  )}
                />
              )}
            />
            <Typography
              variant="caption"
              className="quick-create-link"
              onClick={() => setCategoryDialogOpen(true)}
            >
              <FontAwesomeIcon icon={faPlus} className="quick-create-icon" />
              {t('ADD_NEW_CATEGORY')}
            </Typography>

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
                  helperText={errors.paymentMethodId ? t(errors.paymentMethodId.message || '') : ''}
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
            <Typography
              variant="caption"
              className="quick-create-link"
              onClick={() => setPaymentMethodDialogOpen(true)}
            >
              <FontAwesomeIcon icon={faPlus} className="quick-create-icon" />
              {t('ADD_NEW_PAYMENT_METHOD')}
            </Typography>

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
              name="frequency"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label={t('FREQUENCY')}
                  fullWidth
                  error={!!errors.frequency}
                  helperText={errors.frequency ? t(errors.frequency.message || '') : ''}
                  className="form-field"
                >
                  {Object.values(RecurrenceFrequency).map((f) => (
                    <MenuItem key={f} value={f}>{t(f)}</MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Box className="dates-row">
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label={t('START_DATE')}
                    value={field.value}
                    minDate={recurringExpense ? undefined : today}
                    onChange={(date) => field.onChange(date)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!errors.startDate,
                        helperText: errors.startDate ? t(errors.startDate.message || '') : '',
                        className: 'form-field',
                      },
                    }}
                  />
                )}
              />

              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label={t('END_DATE')}
                    value={field.value || null}
                    minDate={startDateValue}
                    onChange={(date) => field.onChange(date)}
                    slotProps={{
                      field: { clearable: true },
                      textField: {
                        fullWidth: true,
                        error: !!errors.endDate,
                        helperText: errors.endDate ? t(errors.endDate.message || '') : t('RECURRING_END_DATE_HELPER'),
                        className: 'form-field',
                      },
                    }}
                  />
                )}
              />
            </Box>

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
          form="recurring-expense-form"
          variant="contained"
          color="primary"
          disabled={isLoading || isDataLoading}
          className="submit-button"
        >
          {isLoading ? <CircularProgress size={24} /> : recurringExpense ? t('UPDATE') : t('CREATE')}
        </Button>
      </DialogActions>

      <CategoryDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        onSubmit={handleCategoryCreate}
        isLoading={createCategoryMutation.isPending}
      />

      <PaymentTypeDialog
        open={paymentMethodDialogOpen}
        onClose={() => setPaymentMethodDialogOpen(false)}
        onSubmit={handlePaymentMethodCreate}
        isLoading={createPaymentMethodMutation.isPending}
      />
    </Dialog>
  );
}

export default RecurringExpenseDialog;
