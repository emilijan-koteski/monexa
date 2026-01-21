import { useState } from 'react';
import { Alert, Box, Button, Container, IconButton, InputAdornment, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faEye, faEyeSlash, faLock } from '@fortawesome/free-solid-svg-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useLogin } from '../../services/authService.ts';
import LanguageChange from '../../components/language-change/LanguageChange.tsx';
import './login-page.scss';

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const loginSchema = z.object({
    email: z
      .email({ message: t('EMAIL_INVALID') })
      .min(1, { message: t('EMAIL_REQUIRED') }),
    password: z
      .string({ message: t('PASSWORD_REQUIRED') })
      .min(1, { message: t('PASSWORD_REQUIRED') })
      .min(6, { message: t('PASSWORD_MIN_LENGTH') }),
  });

  type LoginFormData = z.infer<typeof loginSchema>;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useLogin();

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data, {
      onSuccess: () => {
        navigate('/home');
      },
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div id="login-page">
      <Container maxWidth="sm">
        <Box className="login-container">
          <Box className="language-change-container">
            <LanguageChange/>
          </Box>

          <Paper className="login-paper">
            <Stack gap={4}>
              <Box className="login-header">
                <Typography variant="h3" className="app-title">
                  {t('APP_TITLE')}
                </Typography>
                <Typography variant="h5" className="login-title">
                  {t('LOGIN')}
                </Typography>
              </Box>

              {loginMutation.isError && (
                <Alert severity="error">
                  {loginMutation.error?.message || t('LOGIN_ERROR')}
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

                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label={t('PASSWORD')}
                        placeholder={t('ENTER_PASSWORD')}
                        type={showPassword ? 'text' : 'password'}
                        error={!!errors.password}
                        helperText={errors.password?.message}
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
                                  onClick={togglePasswordVisibility}
                                  edge="end"
                                >
                                  <FontAwesomeIcon
                                    icon={showPassword ? faEyeSlash : faEye}
                                  />
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
                    disabled={loginMutation.isPending}
                    className="login-button"
                  >
                    {loginMutation.isPending ? '...' : t('SIGN_IN')}
                  </Button>
                </Stack>
              </form>

              <Box className="register-link-container">
                <Typography variant="body2">
                  {t('DONT_HAVE_ACCOUNT')}{' '}
                  <Link component={RouterLink} to="/register">
                    {t('SIGN_UP')}
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

export default LoginPage;
