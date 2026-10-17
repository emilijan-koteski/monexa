import './connected-apps-page.scss';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCircleCheck,
  faKey,
  faPlug,
  faPlus,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { enGB, mk } from 'date-fns/locale';
import { toast } from 'react-toastify';
import AccessTokenDialog from '../../../components/access-token-dialog/AccessTokenDialog';
import ConfirmationDialog from '../../../components/confirmation-dialog/ConfirmationDialog';
import {
  isAccessTokenNotFoundError,
  useAccessTokens,
  useRevokeAccessToken,
} from '../../../services/accessTokenService';
import { isOAuthNotFoundError, useOAuthGrants, useRevokeOAuthGrant } from '../../../services/oauthService';
import type { AccessToken, OAuthGrant } from '../../../types/models';
import { MAX_ACTIVE_ACCESS_TOKENS } from '../../../utils/accessToken';
import { getClientIdentity, getPermissionLabelKey } from '../../../utils/oauth';
import { Language } from '../../../enums/Language';

const DATE_FORMAT = 'PP';

interface ListContentProps<Item extends { id: number }> {
  items: Item[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyTitleKey: string;
  emptyMessageKey: string;
  renderItem: (item: Item) => ReactNode;
}

interface ConnectedAppItemProps {
  grant: OAuthGrant;
  disabled: boolean;
  onDisconnect: (grant: OAuthGrant) => void;
}

interface AccessTokenItemProps {
  accessToken: AccessToken;
  disabled: boolean;
  onRevoke: (accessToken: AccessToken) => void;
}

const formatDate = (value: string, locale: Locale): string => format(new Date(value), DATE_FORMAT, { locale });

const dateLocaleFor = (language: string): Locale => (language === Language.MK ? mk : enGB);

function ListContent<Item extends { id: number }>({
  items,
  isLoading,
  isError,
  onRetry,
  emptyTitleKey,
  emptyMessageKey,
  renderItem,
}: ListContentProps<Item>) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Box className="loading-container">
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            {t('OAUTH_RETRY')}
          </Button>
        }
      >
        {t('CONNECTED_APPS_LOAD_ERROR')}
      </Alert>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Stack gap={1} className="empty-state">
        <Typography variant="h6" color="text.primary" fontWeight="bold">
          {t(emptyTitleKey)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(emptyMessageKey)}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack gap={1.5}>
      {items.map((item) => (
        <Box key={item.id}>{renderItem(item)}</Box>
      ))}
    </Stack>
  );
}

function ConnectedAppItem({ grant, disabled, onDisconnect }: ConnectedAppItemProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocaleFor(i18n.language);
  const identity = getClientIdentity(grant);
  const lastUsed = grant.lastUsedAt ? formatDate(grant.lastUsedAt, dateLocale) : t('CONNECTED_APPS_NEVER');

  return (
    <Card className="connection-item">
      <CardContent className="connection-content">
        <Avatar variant="rounded" className="connection-avatar">
          <FontAwesomeIcon icon={faPlug} />
        </Avatar>

        <Box className="connection-info">
          <Stack flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" className="connection-name">
              {identity.name || t('OAUTH_UNNAMED_APP')}
            </Typography>
            {identity.isVerified ? (
              <Chip
                size="small"
                color="success"
                variant="outlined"
                icon={<FontAwesomeIcon icon={faCircleCheck} />}
                label={t('OAUTH_VERIFIED')}
              />
            ) : (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
                label={t('OAUTH_UNVERIFIED_APP')}
              />
            )}
            <Chip size="small" label={t(getPermissionLabelKey(grant.scopes))} className="permission-chip" />
          </Stack>
          <Typography variant="caption" className="connection-meta">
            {t('CONNECTED_APPS_CONNECTED_ON', { date: formatDate(grant.createdAt, dateLocale) })}
            {' · '}
            {t('CONNECTED_APPS_LAST_USED', { value: lastUsed })}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="error"
          size="small"
          disabled={disabled}
          onClick={() => onDisconnect(grant)}
          className="connection-action"
        >
          {t('OAUTH_DISCONNECT')}
        </Button>
      </CardContent>
    </Card>
  );
}

function AccessTokenItem({ accessToken, disabled, onRevoke }: AccessTokenItemProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocaleFor(i18n.language);
  const lastUsed = accessToken.lastUsedAt ? formatDate(accessToken.lastUsedAt, dateLocale) : t('CONNECTED_APPS_NEVER');

  return (
    <Card className="connection-item">
      <CardContent className="connection-content">
        <Avatar variant="rounded" className="connection-avatar">
          <FontAwesomeIcon icon={faKey} />
        </Avatar>

        <Box className="connection-info">
          <Stack flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" className="connection-name">
              {accessToken.name}
            </Typography>
            <Chip size="small" label={t(getPermissionLabelKey(accessToken.scopes))} className="permission-chip" />
          </Stack>
          <Typography variant="body2" className="token-prefix">
            {accessToken.tokenPrefix}…
          </Typography>
          <Typography variant="caption" className="connection-meta">
            {t('CONNECTED_APPS_LAST_USED', { value: lastUsed })}
            {' · '}
            {t('ACCESS_TOKEN_EXPIRES', { date: formatDate(accessToken.expiresAt, dateLocale) })}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="error"
          size="small"
          disabled={disabled}
          onClick={() => onRevoke(accessToken)}
          className="connection-action"
        >
          {t('ACCESS_TOKEN_REVOKE')}
        </Button>
      </CardContent>
    </Card>
  );
}

const ConnectedAppsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const grantsQuery = useOAuthGrants();
  const accessTokensQuery = useAccessTokens();
  const revokeGrantMutation = useRevokeOAuthGrant();
  const revokeAccessTokenMutation = useRevokeAccessToken();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [grantToDisconnect, setGrantToDisconnect] = useState<OAuthGrant | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [accessTokenToRevoke, setAccessTokenToRevoke] = useState<AccessToken | null>(null);

  const isUnavailable = isOAuthNotFoundError(grantsQuery.error) || isAccessTokenNotFoundError(accessTokensQuery.error);
  const isLimitReached = (accessTokensQuery.data?.length ?? 0) >= MAX_ACTIVE_ACCESS_TOKENS;
  const isAnyRevokeLoading = revokeGrantMutation.isPending || revokeAccessTokenMutation.isPending;
  const disconnectedAppName = grantToDisconnect
    ? getClientIdentity(grantToDisconnect).name || t('OAUTH_UNNAMED_APP')
    : '';

  const handleBack = () => {
    navigate('/settings');
  };

  const handleDisconnectClick = (grant: OAuthGrant) => {
    setGrantToDisconnect(grant);
    setDisconnectDialogOpen(true);
  };

  const handleDisconnectConfirm = async () => {
    if (!grantToDisconnect) return;

    try {
      await revokeGrantMutation.mutateAsync(grantToDisconnect.id);
      toast.success(t('OAUTH_DISCONNECT_SUCCESS'));
      setDisconnectDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('OAUTH_DISCONNECT_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleRevokeClick = (accessToken: AccessToken) => {
    setAccessTokenToRevoke(accessToken);
    setRevokeDialogOpen(true);
  };

  const handleRevokeConfirm = async () => {
    if (!accessTokenToRevoke) return;

    try {
      await revokeAccessTokenMutation.mutateAsync(accessTokenToRevoke.id);
      toast.success(t('ACCESS_TOKEN_REVOKE_SUCCESS'));
      setRevokeDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('ACCESS_TOKEN_REVOKE_ERROR');
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <Container maxWidth="md" id="connected-apps-page">
        <Box className="page-header">
          <IconButton color="primary" onClick={handleBack} className="back-button">
            <FontAwesomeIcon icon={faArrowLeft} />
          </IconButton>
          <Typography variant="h5" color="text.primary" fontWeight="600" className="page-title">
            {t('CONNECTED_APPS')}
          </Typography>
        </Box>

        {isUnavailable ? (
          <Box className="empty-state">
            <Typography variant="body1" color="text.secondary">
              {t('CONNECTED_APPS_UNAVAILABLE')}
            </Typography>
          </Box>
        ) : (
          <>
            <Box component="section" className="page-section">
              <Typography variant="h6" component="h2" color="text.primary" fontWeight="600" className="section-title">
                {t('AI_APPS')}
              </Typography>
              <ListContent
                items={grantsQuery.data}
                isLoading={grantsQuery.isLoading}
                isError={grantsQuery.isError}
                onRetry={() => grantsQuery.refetch()}
                emptyTitleKey="OAUTH_NO_CONNECTED_APPS_TITLE"
                emptyMessageKey="OAUTH_NO_CONNECTED_APPS_MESSAGE"
                renderItem={(grant) => (
                  <ConnectedAppItem grant={grant} disabled={isAnyRevokeLoading} onDisconnect={handleDisconnectClick} />
                )}
              />
              <Typography variant="caption" color="text.secondary" className="section-note">
                {t('CONNECTED_APPS_SIGN_OUT_NOTE')} {t('CONNECTED_APPS_ACCOUNT_CHANGES_NOTE')}
              </Typography>
            </Box>

            <Box component="section" className="page-section">
              <Box className="section-header">
                <Typography variant="h6" component="h2" color="text.primary" fontWeight="600" className="section-title">
                  {t('ACCESS_TOKENS')}
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={isLimitReached}
                  onClick={() => setCreateDialogOpen(true)}
                  className="create-button"
                  startIcon={<FontAwesomeIcon icon={faPlus} />}
                >
                  {t('ACCESS_TOKEN_CREATE')}
                </Button>
              </Box>
              {isLimitReached && (
                <Typography variant="caption" color="text.secondary" className="section-note">
                  {t('ACCESS_TOKEN_LIMIT_REACHED')}
                </Typography>
              )}
              <ListContent
                items={accessTokensQuery.data}
                isLoading={accessTokensQuery.isLoading}
                isError={accessTokensQuery.isError}
                onRetry={() => accessTokensQuery.refetch()}
                emptyTitleKey="ACCESS_TOKEN_EMPTY_TITLE"
                emptyMessageKey="ACCESS_TOKEN_EMPTY_MESSAGE"
                renderItem={(accessToken) => (
                  <AccessTokenItem
                    accessToken={accessToken}
                    disabled={isAnyRevokeLoading}
                    onRevoke={handleRevokeClick}
                  />
                )}
              />
            </Box>
          </>
        )}
      </Container>

      <AccessTokenDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />

      <ConfirmationDialog
        open={disconnectDialogOpen}
        onClose={() => setDisconnectDialogOpen(false)}
        onConfirm={handleDisconnectConfirm}
        isLoading={revokeGrantMutation.isPending}
        title="OAUTH_DISCONNECT_TITLE"
        message="OAUTH_DISCONNECT_MESSAGE"
        messageParams={{ name: disconnectedAppName }}
        confirmText="OAUTH_DISCONNECT"
        confirmColor="error"
      />

      <ConfirmationDialog
        open={revokeDialogOpen}
        onClose={() => setRevokeDialogOpen(false)}
        onConfirm={handleRevokeConfirm}
        isLoading={revokeAccessTokenMutation.isPending}
        title="ACCESS_TOKEN_REVOKE_TITLE"
        message="ACCESS_TOKEN_REVOKE_MESSAGE"
        messageParams={{ name: accessTokenToRevoke?.name ?? '' }}
        confirmText="ACCESS_TOKEN_REVOKE"
        confirmColor="error"
      />
    </>
  );
};

export default ConnectedAppsPage;
