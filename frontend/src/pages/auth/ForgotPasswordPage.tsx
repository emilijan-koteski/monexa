import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, InputAdornment, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { useForgotPassword } from '../../services/authService.ts';
import LanguageChange from '../../components/language-change/LanguageChange.tsx';
import './forgot-password-page.scss';

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [emailSent, setEmailSent] = useState(false);

  const forgotPasswordSchema = z.object({
    email: z
      .email({ message: t('EMAIL_INVALID') })
      .min(1, { message: t('EMAIL_REQUIRED') }),
  });

  type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const forgotPasswordMutation = useForgotPassword();

  const onSubmit = (data: ForgotPasswordFormData) => {
    forgotPasswordMutation.mutate(data.email, {
      onSuccess: () => {
        setEmailSent(true);
      },
    });
  };

  return (
    <div id="forgot-password-page">
      <Container maxWidth="sm">
        <Box className="forgot-password-container">
          <Box className="language-change-container">
            <LanguageChange/>
          </Box>

          <Paper className="forgot-password-paper">
            <Stack gap={4}>
              <Box className="forgot-password-header">
                <Typography variant="h3" className="app-title">
                  {t('APP_TITLE')}
                </Typography>
                <Typography variant="h5" className="forgot-password-title">
                  {t('FORGOT_PASSWORD_TITLE')}
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {t('FORGOT_PASSWORD_SUBTITLE')}
                </Typography>
              </Box>

              {emailSent && (
                <Alert severity="success">
                  {t('FORGOT_PASSWORD_EMAIL_SENT')}
                </Alert>
              )}

              {forgotPasswordMutation.isError && (
                <Alert severity="error">
                  {forgotPasswordMutation.error?.message || t('FORGOT_PASSWORD_ERROR')}
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)}>
                <Stack gap={3}>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label={t('EMAIL')}
                        placeholder={t('ENTER_EMAIL')}
                        type="email"
                        error={!!errors.email}
                        helperText={errors.email?.message}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <FontAwesomeIcon icon={faEnvelope}/>
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    )}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={forgotPasswordMutation.isPending}
                    className="forgot-password-button"
                  >
                    {forgotPasswordMutation.isPending ? <CircularProgress size={24} color="inherit" /> : t('SEND_RESET_LINK')}
                  </Button>
                </Stack>
              </form>

              <Box className="back-to-login-container">
                <Typography variant="body2">
                  <Link component={RouterLink} to="/login">
                    {t('BACK_TO_LOGIN')}
                  </Link>
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Crafted with 💙 by Emilijan Koteski
            </Typography>
          </Box>
        </Box>
      </Container>
    </div>
  );
};

export default ForgotPasswordPage;
