import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Container, FormControlLabel, FormHelperText, IconButton, InputAdornment, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faEye, faEyeSlash, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useRegister } from '../../services/authService.ts';
import { useActiveDocuments } from '../../services/legalDocumentService.ts';
import { DocumentType } from '../../enums/DocumentType.ts';
import LanguageChange from '../../components/language-change/LanguageChange.tsx';
import './register-page.scss';

const RegisterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const { data: legalDocuments } = useActiveDocuments();
  const privacyPolicy = legalDocuments?.find(doc => doc.type === DocumentType.PRIVACY_POLICY);
  const termsOfService = legalDocuments?.find(doc => doc.type === DocumentType.TERMS_OF_SERVICE);

  const registerSchema = z.object({
    name: z
      .string({ message: t('NAME_REQUIRED') })
      .min(1, { message: t('NAME_REQUIRED') })
      .min(2, { message: t('NAME_MIN_LENGTH') }),
    email: z
      .email({ message: t('EMAIL_INVALID') })
      .min(1, { message: t('EMAIL_REQUIRED') }),
    password: z
      .string({ message: t('PASSWORD_REQUIRED') })
      .min(1, { message: t('PASSWORD_REQUIRED') })
      .min(6, { message: t('PASSWORD_MIN_LENGTH') }),
    confirmPassword: z
      .string({ message: t('CONFIRM_PASSWORD_REQUIRED') })
      .min(1, { message: t('CONFIRM_PASSWORD_REQUIRED') }),
    acceptPrivacyPolicy: z
      .boolean()
      .refine(val => val === true, { message: t('PRIVACY_POLICY_REQUIRED') }),
    acceptTermsOfService: z
      .boolean()
      .refine(val => val === true, { message: t('TERMS_OF_SERVICE_REQUIRED') }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('PASSWORDS_DONT_MATCH'),
    path: ['confirmPassword'],
  });

  type RegisterFormData = z.infer<typeof registerSchema>;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptPrivacyPolicy: false,
      acceptTermsOfService: false,
    },
  });

  const registerMutation = useRegister();

  const onSubmit = (data: RegisterFormData) => {
    const acceptedDocumentIds: number[] = [];
    if (data.acceptPrivacyPolicy && privacyPolicy) {
      acceptedDocumentIds.push(privacyPolicy.id);
    }
    if (data.acceptTermsOfService && termsOfService) {
      acceptedDocumentIds.push(termsOfService.id);
    }

    const registerData = {
      name: data.name,
      email: data.email,
      password: data.password,
      acceptedDocumentIds,
    };

    registerMutation.mutate(registerData, {
      onSuccess: () => {
        navigate('/login');
      },
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div id="register-page">
      <Container maxWidth="sm">
        <Box className="register-container">
          <Box className="language-change-container">
            <LanguageChange/>
          </Box>

          <Paper className="register-paper">
            <Stack gap={4}>
              <Box className="register-header">
                <Typography variant="h3" component="h1" className="app-title">
                  {t('APP_TITLE')}
                </Typography>
                <Typography variant="h5" component="h2" className="register-title">
                  {t('REGISTER')}
                </Typography>
              </Box>

              {registerMutation.isSuccess && (
                <Alert severity="success">
                  {t('REGISTER_SUCCESS')}
                </Alert>
              )}

              {registerMutation.isError && (
                <Alert severity="error">
                  {registerMutation.error?.message || t('REGISTER_ERROR')}
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)}>
                <Stack gap={3}>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label={t('NAME')}
                        placeholder={t('ENTER_NAME')}
                        error={!!errors.name}
                        helperText={errors.name?.message}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <FontAwesomeIcon icon={faUser}/>
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    )}
                  />

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
                                  onClick={toggleConfirmPasswordVisibility}
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

                  <Box className="legal-consent-section">
                    <Controller
                      name="acceptPrivacyPolicy"
                      control={control}
                      render={({ field }) => (
                        <Box>
                          <FormControlLabel
                            control={
                              <Checkbox
                                {...field}
                                checked={field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                              />
                            }
                            label={
                              <Typography variant="body2">
                                {t('ACCEPT_PRIVACY_POLICY_PREFIX')}{' '}
                                <Link
                                  href="/privacy-policy"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {t('PRIVACY_POLICY')}
                                </Link>
                              </Typography>
                            }
                          />
                          {errors.acceptPrivacyPolicy && (
                            <FormHelperText error>
                              {errors.acceptPrivacyPolicy.message}
                            </FormHelperText>
                          )}
                        </Box>
                      )}
                    />

                    <Controller
                      name="acceptTermsOfService"
                      control={control}
                      render={({ field }) => (
                        <Box>
                          <FormControlLabel
                            control={
                              <Checkbox
                                {...field}
                                checked={field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                              />
                            }
                            label={
                              <Typography variant="body2">
                                {t('ACCEPT_TERMS_PREFIX')}{' '}
                                <Link
                                  href="/terms-of-service"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {t('TERMS_OF_SERVICE')}
                                </Link>
                              </Typography>
                            }
                          />
                          {errors.acceptTermsOfService && (
                            <FormHelperText error>
                              {errors.acceptTermsOfService.message}
                            </FormHelperText>
                          )}
                        </Box>
                      )}
                    />
                  </Box>

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={registerMutation.isPending}
                    className="register-button"
                  >
                    {registerMutation.isPending ? '...' : t('SIGN_UP')}
                  </Button>
                </Stack>
              </form>

              <Box className="login-link-container">
                <Typography variant="body2">
                  {t('ALREADY_HAVE_ACCOUNT')}{' '}
                  <Link component={RouterLink} to="/login">
                    {t('SIGN_IN')}
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

export default RegisterPage;
