import './payment-type-dialog.scss';
import { useEffect } from 'react';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, useMediaQuery, useTheme } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { PaymentMethod } from '../../types/models';

interface PaymentTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentTypeFormData) => void;
  paymentMethod?: PaymentMethod | null;
  isLoading?: boolean;
}

export interface PaymentTypeFormData {
  name: string;
}

const paymentTypeSchema = z.object({
  name: z.string().min(1, 'PAYMENT_TYPE_NAME_REQUIRED'),
});

function PaymentTypeDialog({
  open,
  onClose,
  onSubmit,
  paymentMethod,
  isLoading = false,
}: PaymentTypeDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentTypeFormData>({
    resolver: zodResolver(paymentTypeSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (paymentMethod) {
        reset({
          name: paymentMethod.name,
        });
      } else {
        reset({
          name: '',
        });
      }
    }
  }, [open, paymentMethod, reset]);

  const handleFormSubmit = (data: PaymentTypeFormData) => {
    onSubmit(data);
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      id="payment-type-dialog"
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        {paymentMethod ? t('EDIT_PAYMENT_TYPE') : t('NEW_PAYMENT_TYPE')}
      </DialogTitle>

      <DialogContent className='dialog-content'>
        <form id="payment-type-form" onSubmit={handleSubmit(handleFormSubmit)}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('PAYMENT_TYPE_NAME')}
                fullWidth
                autoFocus
                error={!!errors.name}
                helperText={errors.name ? t(errors.name.message || '') : ''}
                placeholder={t('PAYMENT_TYPE_NAME_PLACEHOLDER')}
              />
            )}
          />
        </form>
      </DialogContent>

      <DialogActions className="dialog-actions">
        <Button onClick={handleClose} variant='text' disabled={isLoading} className="cancel-button">
          {t('CANCEL')}
        </Button>
        <Button
          type="submit"
          form="payment-type-form"
          variant="contained"
          color="primary"
          disabled={isLoading}
          className="submit-button"
        >
          {isLoading ? (
            <CircularProgress size={24} />
          ) : paymentMethod ? (
            t('UPDATE')
          ) : (
            t('CREATE')
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PaymentTypeDialog;
