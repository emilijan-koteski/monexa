import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Avatar, Box, Button, Chip, CircularProgress, Container, Link, Paper, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCircleCheck, faPlug, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import ConnectedAppPrivacyNotice from '../../components/connected-app-privacy-notice/ConnectedAppPrivacyNotice.tsx';
import LanguageChange from '../../components/language-change/LanguageChange.tsx';
import { useLogout } from '../../services/authService.ts';
import {
  isOAuthNotFoundError,
  useApproveAuthorization,
  useDenyAuthorization,
  useOAuthAuthorization,
} from '../../services/oauthService.ts';
import { useUser } from '../../services/userService.ts';
import type { OAuthAuthorization } from '../../types/models.ts';
import {
  getClientIdentity,
  getVerifiedClientLogoUri,
  getScopeLabelKey,
  isSafeRedirectUrl,
  stripHiddenCharacters,
} from '../../utils/oauth.ts';
import './oauth-consent-page.scss';

interface ConsentShellProps {
  children: ReactNode;
}

interface ConsentRequestProps {
  authorization: OAuthAuthorization;
}

interface LoadFailedProps {
  onRetry: () => void;
}

const ConsentShell = ({ children }: ConsentShellProps) => {
  const { t } = useTranslation();

  return (
    <div id="oauth-consent-page">
      <Container maxWidth="sm">
        <Box className="consent-container">
          <Box className="language-change-container">
            <LanguageChange/>
          </Box>

          <Paper className="consent-paper">
            <Stack gap={3}>
              <Box className="consent-header">
                <Typography variant="h3" component="h1" className="app-title">
                  {t('APP_TITLE')}
                </Typography>
              </Box>
              {children}
            </Stack>
          </Paper>
        </Box>
      </Container>
    </div>
  );
};

const RequestUnavailable = () => {
  const { t } = useTranslation();

  return (
    <Stack className="state-message" gap={2}>
      <FontAwesomeIcon icon={faTriangleExclamation} className="state-icon"/>
      <Typography variant="h5" component="h2">
        {t('OAUTH_REQUEST_UNAVAILABLE_TITLE')}
      </Typography>
      <Typography color="text.secondary">
        {t('OAUTH_REQUEST_UNAVAILABLE_MESSAGE')}
      </Typography>
    </Stack>
  );
};

const LoadFailed = ({ onRetry }: LoadFailedProps) => {
  const { t } = useTranslation();

  return (
    <Stack className="state-message" gap={2}>
      <FontAwesomeIcon icon={faTriangleExclamation} className="state-icon"/>
      <Typography color="text.secondary">
        {t('OAUTH_LOAD_ERROR')}
      </Typography>
      <Button variant="outlined" onClick={onRetry}>
        {t('OAUTH_RETRY')}
      </Button>
    </Stack>
  );
};

const ConsentRequest = ({ authorization }: ConsentRequestProps) => {
  const { t } = useTranslation();
  const user = useUser();
  const logoutMutation = useLogout();
  const approveMutation = useApproveAuthorization();
  const denyMutation = useDenyAuthorization();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isRedirectRejected, setIsRedirectRejected] = useState(false);

  const identity = getClientIdentity(authorization);
  const logoUri = getVerifiedClientLogoUri(identity, authorization.logoUri);
  const redirectDestination = stripHiddenCharacters(authorization.redirectHost || authorization.redirectUri);
  const decisionError = approveMutation.error ?? denyMutation.error;
  const isBusy = approveMutation.isPending || denyMutation.isPending || isRedirecting;
  const { reset: resetApprove } = approveMutation;
  const { reset: resetDeny } = denyMutation;

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        resetApprove();
        resetDeny();
        setIsRedirecting(false);
        setIsRedirectRejected(false);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [resetApprove, resetDeny]);

  if (isOAuthNotFoundError(decisionError)) {
    return <RequestUnavailable/>;
  }

  const handleDecision = (mutation: typeof approveMutation) => {
    setIsRedirectRejected(false);
    resetApprove();
    resetDeny();
    mutation.mutate(authorization.id, {
      onSuccess: ({ redirectUrl }) => {
        if (!isSafeRedirectUrl(redirectUrl)) {
          setIsRedirectRejected(true);
          return;
        }
        setIsRedirecting(true);
        window.location.assign(redirectUrl);
      },
    });
  };

  return (
    <>
      <Stack className="app-identity" gap={1.5}>
        <Avatar
          variant="rounded"
          src={logoUri ?? undefined}
          slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
          className="app-logo"
        >
          <FontAwesomeIcon icon={faPlug}/>
        </Avatar>
        <Typography variant="h5" component="h2" className="app-name">
          {identity.name || t('OAUTH_UNNAMED_APP')}
        </Typography>
        {identity.isVerified && (
          <Chip
            size="small"
            color="success"
            variant="outlined"
            icon={<FontAwesomeIcon icon={faCircleCheck}/>}
            label={t('OAUTH_VERIFIED')}
          />
        )}
        {!identity.isVerified && (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            icon={<FontAwesomeIcon icon={faTriangleExclamation}/>}
            label={t('OAUTH_UNVERIFIED_APP')}
          />
        )}
        <Typography color="text.secondary">
          {t('OAUTH_WANTS_ACCESS')}
        </Typography>
      </Stack>

      <Box className="redirect-notice">
        <Typography variant="body2" color="text.secondary">
          {t('OAUTH_REDIRECT_NOTICE')}
        </Typography>
        <Typography variant="h6" component="p" className="redirect-host">
          {redirectDestination}
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle1" fontWeight={600} className="permissions-title">
          {t('OAUTH_PERMISSIONS_TITLE')}
        </Typography>
        <Stack component="ul" className="permission-list" gap={1}>
          {authorization.scopes.map((scope) => {
            const labelKey = getScopeLabelKey(scope);
            return (
              <Box component="li" key={scope} className="permission-item">
                <FontAwesomeIcon icon={faCheck} className="permission-icon"/>
                <Typography variant="body2">
                  {labelKey ? t(labelKey) : stripHiddenCharacters(scope)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
        <ConnectedAppPrivacyNotice/>
      </Box>

      {user && (
        <Typography variant="body2" color="text.secondary" className="account-row">
          {t('OAUTH_SIGNED_IN_AS', { email: user.email })}{' '}
          <Link
            component="button"
            type="button"
            variant="body2"
            disabled={isBusy || logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {t('OAUTH_NOT_YOU')}
          </Link>
        </Typography>
      )}

      {(decisionError || isRedirectRejected) && (
        <Alert severity="error">
          {t('OAUTH_DECISION_ERROR')}
        </Alert>
      )}

      <Box className="decision-buttons">
        <Button
          variant="outlined"
          size="large"
          disabled={isBusy}
          className="deny-button"
          onClick={() => handleDecision(denyMutation)}
        >
          {denyMutation.isPending ? <CircularProgress size={24} color="inherit"/> : t('OAUTH_DENY')}
        </Button>
        <Button
          variant="contained"
          size="large"
          disabled={isBusy}
          className="approve-button"
          onClick={() => handleDecision(approveMutation)}
        >
          {approveMutation.isPending ? <CircularProgress size={24} color="inherit"/> : t('OAUTH_APPROVE')}
        </Button>
      </Box>

      {isRedirecting && (
        <Typography variant="body2" color="text.secondary" className="redirecting-note">
          {t('OAUTH_REDIRECTING')}
        </Typography>
      )}

      <Typography variant="caption" color="text.secondary" className="disconnect-note">
        {t('OAUTH_DISCONNECT_NOTE')}
      </Typography>
    </>
  );
};

const OAuthConsentPage = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const authorizationQuery = useOAuthAuthorization(id);

  if (!id) {
    return (
      <ConsentShell>
        <RequestUnavailable/>
      </ConsentShell>
    );
  }

  if (authorizationQuery.isPending) {
    return (
      <ConsentShell>
        <Box className="state-loading">
          <CircularProgress/>
        </Box>
      </ConsentShell>
    );
  }

  if (authorizationQuery.isError) {
    return (
      <ConsentShell>
        {isOAuthNotFoundError(authorizationQuery.error)
          ? <RequestUnavailable/>
          : <LoadFailed onRetry={() => authorizationQuery.refetch()}/>}
      </ConsentShell>
    );
  }

  return (
    <ConsentShell>
      <ConsentRequest authorization={authorizationQuery.data}/>
    </ConsentShell>
  );
};

export default OAuthConsentPage;
