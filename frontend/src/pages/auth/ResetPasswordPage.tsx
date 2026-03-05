import { useState } from 'react';
import { Alert, Box, Button, Container, IconButton, InputAdornment, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock } from '@fortawesome/free-solid-svg-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import { useResetPassword } from '../../services/authService.ts';
import LanguageChange from '../../components/language-change/LanguageChange.tsx';
import './reset-password-page.scss';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetPasswordSchema = z.object({
    newPassword: z
      .string({ message: t('PASSWORD_REQUIRED') })
      .min(1, { message: t('PASSWORD_REQUIRED') })
      .min(6, { message: t('PASSWORD_MIN_LENGTH') }),
    confirmPassword: z
      .string({ message: t('CONFIRM_PASSWORD_REQUIRED') })
      .min(1, { message: t('CONFIRM_PASSWORD_REQUIRED') }),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('PASSWORDS_DONT_MATCH'),
    path: ['confirmPassword'],
  });

  type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const resetPasswordMutation = useResetPassword();

  const onSubmit = (data: ResetPasswordFormData) => {
    if (!token) return;

    resetPasswordMutation.mutate(
      {
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      },
      {
        onSuccess: () => {
          navigate('/home');
        },
      },
    );
  };

  if (!token) {
    return (
      <div id="reset-password-page">
        <Container maxWidth="sm">
          <Box className="reset-password-container">
            <Box className="language-change-container">
              <LanguageChange/>
            </Box>

            <Paper className="reset-password-paper">
              <Stack gap={4}>
                <Box className="reset-password-header">
                  <Typography variant="h3" className="app-title">
                    {t('APP_TITLE')}
                  </Typography>
                </Box>

                <Alert severity="error">
                  {t('RESET_LINK_INVALID')}
                </Alert>

                <Box className="back-to-login-container">
                  <Typography variant="body2">
                    <Link component={RouterLink} to="/forgot-password">
                      {t('FORGOT_PASSWORD_TITLE')}
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
  }

  return (
    <div id="reset-password-page">
      <Container maxWidth="sm">
        <Box className="reset-password-container">
          <Box className="language-change-container">
            <LanguageChange/>
          </Box>

          <Paper className="reset-password-paper">
            <Stack gap={4}>
              <Box className="reset-password-header">
                <Typography variant="h3" className="app-title">
                  {t('APP_TITLE')}
                </Typography>
                <Typography variant="h5" className="reset-password-title">
                  {t('RESET_PASSWORD_TITLE')}
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {t('RESET_PASSWORD_SUBTITLE')}
                </Typography>
              </Box>

              {resetPasswordMutation.isError && (
                <Alert severity="error">
                  {resetPasswordMutation.error?.message || t('RESET_PASSWORD_ERROR')}
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)}>
                <Stack gap={3}>
                  <Controller
                    name="newPassword"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label={t('NEW_PASSWORD')}
                        placeholder={t('ENTER_NEW_PASSWORD')}
                        type={showPassword ? 'text' : 'password'}
                        error={!!errors.newPassword}
                        helperText={errors.newPassword?.message}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <FontAwesomeIcon icon={faLock}/>
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowPassword(!showPassword)}
                                  edge="end"
                                >
                                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye}/>
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
                        fullWidth
                        label={t('CONFIRM_PASSWORD')}
                        placeholder={t('ENTER_CONFIRM_PASSWORD')}
                        type={showConfirmPassword ? 'text' : 'password'}
                        error={!!errors.confirmPassword}
                        helperText={errors.confirmPassword?.message}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <FontAwesomeIcon icon={faLock}/>
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  edge="end"
                                >
                                  <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye}/>
                                </IconButton>
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
                    disabled={resetPasswordMutation.isPending}
                    className="reset-password-button"
                  >
                    {resetPasswordMutation.isPending ? '...' : t('SET_NEW_PASSWORD')}
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

export default ResetPasswordPage;
