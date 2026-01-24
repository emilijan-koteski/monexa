import './change-password-dialog.scss';
import { useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ChangePasswordFormData) => void;
  isLoading?: boolean;
}

export interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'CURRENT_PASSWORD_REQUIRED'),
    newPassword: z.string().min(6, 'PASSWORD_MIN_LENGTH'),
    confirmPassword: z.string().min(1, 'CONFIRM_PASSWORD_REQUIRED'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'PASSWORDS_DONT_MATCH',
    path: ['confirmPassword'],
  });

function ChangePasswordDialog({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open, reset]);

  const handleFormSubmit = (data: ChangePasswordFormData) => {
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
      id="change-password-dialog"
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>{t('CHANGE_PASSWORD')}</DialogTitle>

      <DialogContent className="dialog-content">
        <form id="change-password-form" onSubmit={handleSubmit(handleFormSubmit)}>
          <Controller
            name="currentPassword"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type={showCurrentPassword ? 'text' : 'password'}
                label={t('CURRENT_PASSWORD')}
                fullWidth
                autoFocus
                error={!!errors.currentPassword}
                helperText={errors.currentPassword ? t(errors.currentPassword.message || '') : ''}
                placeholder={t('ENTER_CURRENT_PASSWORD')}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          edge="end"
                        >
                          <FontAwesomeIcon icon={showCurrentPassword ? faEyeSlash : faEye} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
          />

          <Controller
            name="newPassword"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type={showNewPassword ? 'text' : 'password'}
                label={t('NEW_PASSWORD')}
                fullWidth
                error={!!errors.newPassword}
                helperText={errors.newPassword ? t(errors.newPassword.message || '') : ''}
                placeholder={t('ENTER_NEW_PASSWORD')}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                        >
                          <FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type={showConfirmPassword ? 'text' : 'password'}
                label={t('CONFIRM_NEW_PASSWORD')}
                fullWidth
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword ? t(errors.confirmPassword.message || '') : ''}
                placeholder={t('ENTER_CONFIRM_NEW_PASSWORD')}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
          />
        </form>
      </DialogContent>

      <DialogActions className="dialog-actions">
        <Button onClick={handleClose} disabled={isLoading} className="cancel-button">
          {t('CANCEL')}
        </Button>
        <Button
          type="submit"
          form="change-password-form"
          variant="contained"
          color="primary"
          disabled={isLoading}
          className="submit-button"
        >
          {isLoading ? <CircularProgress size={24} /> : t('CHANGE_PASSWORD')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ChangePasswordDialog;
