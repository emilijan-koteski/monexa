import './access-token-dialog.scss';
import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ENV } from '../../config/env';
import { AccessTokenPermission } from '../../enums/AccessTokenPermission';
import { isAccessTokenLimitError, useCreateAccessToken } from '../../services/accessTokenService';
import type { CreatedAccessToken } from '../../types/models';
import {
  ACCESS_TOKEN_EXPIRY_DAYS,
  ACCESS_TOKEN_NAME_MAX_LENGTH,
  DEFAULT_ACCESS_TOKEN_EXPIRY_DAYS,
  buildClaudeCodeSnippet,
  buildCursorSnippet,
  buildHeaderSnippet,
  buildVsCodeSnippet,
  countCharacters,
} from '../../utils/accessToken';

interface AccessTokenDialogProps {
  open: boolean;
  onClose: () => void;
}

interface TokenRevealProps {
  token: string;
}

const accessTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'ACCESS_TOKEN_NAME_REQUIRED')
    .refine((value) => countCharacters(value) <= ACCESS_TOKEN_NAME_MAX_LENGTH, 'ACCESS_TOKEN_NAME_TOO_LONG'),
  permission: z.enum([AccessTokenPermission.READ, AccessTokenPermission.READ_WRITE]),
  expiresInDays: z.literal(ACCESS_TOKEN_EXPIRY_DAYS),
});

type AccessTokenFormData = z.infer<typeof accessTokenSchema>;

const DEFAULT_FORM_VALUES: AccessTokenFormData = {
  name: '',
  permission: AccessTokenPermission.READ,
  expiresInDays: DEFAULT_ACCESS_TOKEN_EXPIRY_DAYS,
};

const PERMISSION_OPTIONS = [
  { value: AccessTokenPermission.READ, labelKey: 'OAUTH_PERMISSION_READ', hintKey: 'ACCESS_TOKEN_PERMISSION_READ_HINT' },
  {
    value: AccessTokenPermission.READ_WRITE,
    labelKey: 'OAUTH_PERMISSION_READ_WRITE',
    hintKey: 'ACCESS_TOKEN_PERMISSION_READ_WRITE_HINT',
  },
];

const copyToClipboard = async (value: string, successMessage: string, failureMessage: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error(failureMessage);
  }
};

function TokenReveal({ token }: TokenRevealProps) {
  const { t } = useTranslation();
  const [snippetIndex, setSnippetIndex] = useState(0);

  const snippets = [
    { labelKey: 'ACCESS_TOKEN_SNIPPET_CLAUDE_CODE', value: buildClaudeCodeSnippet(ENV.MCP_URL, token) },
    { labelKey: 'ACCESS_TOKEN_SNIPPET_CURSOR', value: buildCursorSnippet(ENV.MCP_URL, token) },
    { labelKey: 'ACCESS_TOKEN_SNIPPET_VS_CODE', value: buildVsCodeSnippet(ENV.MCP_URL, token) },
    { labelKey: 'ACCESS_TOKEN_SNIPPET_HEADER', value: buildHeaderSnippet(token) },
  ];
  const activeSnippet = snippets[snippetIndex];

  const handleCopy = (value: string) =>
    copyToClipboard(value, t('ACCESS_TOKEN_COPIED'), t('ACCESS_TOKEN_COPY_FAILED'));

  return (
    <Box className="token-reveal">
      <Alert severity="warning">{t('ACCESS_TOKEN_COPY_WARNING')}</Alert>

      <TextField
        value={token}
        label={t('ACCESS_TOKEN_LABEL')}
        fullWidth
        className="token-field"
        onFocus={(event) => event.target.select()}
        slotProps={{
          htmlInput: { readOnly: true, spellCheck: false },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  size="small"
                  startIcon={<FontAwesomeIcon icon={faCopy} />}
                  onClick={() => handleCopy(token)}
                  className="copy-button"
                >
                  {t('ACCESS_TOKEN_COPY')}
                </Button>
              </InputAdornment>
            ),
          },
        }}
      />

      <Box className="snippets">
        <Typography variant="subtitle2" color="text.secondary">
          {t('ACCESS_TOKEN_SETUP_TITLE')}
        </Typography>
        <Tabs
          value={snippetIndex}
          onChange={(_, index: number) => setSnippetIndex(index)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t('ACCESS_TOKEN_SETUP_TITLE')}
        >
          {snippets.map((snippet) => (
            <Tab key={snippet.labelKey} label={t(snippet.labelKey)} />
          ))}
        </Tabs>
        <pre className="snippet-code">{activeSnippet.value}</pre>
        <Box className="snippet-footer">
          <Typography variant="caption" color="text.secondary" className="mcp-url-note">
            {t('ACCESS_TOKEN_MCP_URL_NOTE', { url: ENV.MCP_URL })}
          </Typography>
          <Button
            size="small"
            startIcon={<FontAwesomeIcon icon={faCopy} />}
            onClick={() => handleCopy(activeSnippet.value)}
            className="copy-button"
          >
            {t('ACCESS_TOKEN_COPY')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function AccessTokenDialog({ open, onClose }: AccessTokenDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const createMutation = useCreateAccessToken();
  const { reset: resetMutation, isPending } = createMutation;
  const [createdToken, setCreatedToken] = useState<CreatedAccessToken | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccessTokenFormData>({
    resolver: zodResolver(accessTokenSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(DEFAULT_FORM_VALUES);
    }
  }, [open, reset]);

  const handleFormSubmit = async (data: AccessTokenFormData) => {
    try {
      const created = await createMutation.mutateAsync(data);
      setCreatedToken(created);
      resetMutation();
    } catch (error) {
      if (isAccessTokenLimitError(error)) {
        toast.error(t('ACCESS_TOKEN_LIMIT_REACHED'));
      } else {
        toast.error(error instanceof Error ? error.message : t('ACCESS_TOKEN_CREATE_ERROR'));
      }
    }
  };

  const handleClose = () => {
    if (isPending) {
      return;
    }
    setCreatedToken(null);
    onClose();
  };

  const handleDialogClose = (_: unknown, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (createdToken && reason === 'backdropClick') {
      return;
    }
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      id="access-token-dialog"
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>{createdToken ? t('ACCESS_TOKEN_COPY_TITLE') : t('ACCESS_TOKEN_CREATE_TITLE')}</DialogTitle>

      <DialogContent>
        {createdToken ? (
          <TokenReveal token={createdToken.token} />
        ) : (
          <form id="access-token-form" onSubmit={handleSubmit(handleFormSubmit)}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('NAME')}
                  placeholder={t('ACCESS_TOKEN_NAME_PLACEHOLDER')}
                  fullWidth
                  autoFocus
                  error={!!errors.name}
                  helperText={errors.name ? t(errors.name.message || '') : t('ACCESS_TOKEN_NAME_HELPER')}
                />
              )}
            />

            <Controller
              name="permission"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <FormLabel id="access-token-permission-label">{t('ACCESS_TOKEN_PERMISSION_LABEL')}</FormLabel>
                  <RadioGroup {...field} aria-labelledby="access-token-permission-label">
                    {PERMISSION_OPTIONS.map((option) => (
                      <FormControlLabel
                        key={option.value}
                        value={option.value}
                        control={<Radio />}
                        className="permission-option"
                        label={
                          <Box>
                            <Typography variant="body1">{t(option.labelKey)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t(option.hintKey)}
                            </Typography>
                          </Box>
                        }
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              )}
            />

            <Controller
              name="expiresInDays"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label={t('ACCESS_TOKEN_EXPIRY_LABEL')}
                  fullWidth
                  onChange={(event) => field.onChange(Number(event.target.value))}
                >
                  {ACCESS_TOKEN_EXPIRY_DAYS.map((days) => (
                    <MenuItem key={days} value={days}>
                      {t('ACCESS_TOKEN_EXPIRY_DAYS', { days })}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </form>
        )}
      </DialogContent>

      <DialogActions className="dialog-actions">
        {createdToken ? (
          <Button onClick={handleClose} variant="contained" color="primary" className="submit-button">
            {t('ACCESS_TOKEN_DONE')}
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={isPending} className="cancel-button">
              {t('CANCEL')}
            </Button>
            <Button
              type="submit"
              form="access-token-form"
              variant="contained"
              color="primary"
              disabled={isPending}
              className="submit-button"
            >
              {isPending ? <CircularProgress size={24} /> : t('CREATE')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default AccessTokenDialog;
