import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router';
import LanguageChange from '../../components/language-change/LanguageChange.tsx';
import { stripHiddenCharacters } from '../../utils/oauth.ts';
import './oauth-error-page.scss';

const MAX_DESCRIPTION_LENGTH = 200;
const DEFAULT_MESSAGE_KEY = 'OAUTH_ERROR_DEFAULT';

const MESSAGE_KEYS_BY_CODE: Record<string, string> = {
  invalid_client: 'OAUTH_ERROR_INVALID_CLIENT',
  invalid_request: 'OAUTH_ERROR_INVALID_REQUEST',
  server_error: 'OAUTH_ERROR_SERVER_ERROR',
  access_denied: 'OAUTH_ERROR_ACCESS_DENIED',
};

const readDescription = (description: string | null): string => {
  if (description === null || description.length > MAX_DESCRIPTION_LENGTH) {
    return '';
  }
  return stripHiddenCharacters(description).trim();
};

const OAuthErrorPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('error') ?? '';
  const description = readDescription(searchParams.get('error_description'));
  const messageKey = Object.hasOwn(MESSAGE_KEYS_BY_CODE, code) ? MESSAGE_KEYS_BY_CODE[code] : DEFAULT_MESSAGE_KEY;

  return (
    <div id="oauth-error-page">
      <Container maxWidth="sm">
        <Box className="error-container">
          <Box className="language-change-container">
            <LanguageChange/>
          </Box>

          <Paper className="error-paper">
            <Stack gap={3} className="error-content">
              <Typography variant="h3" component="h1" className="app-title">
                {t('APP_TITLE')}
              </Typography>
              <FontAwesomeIcon icon={faTriangleExclamation} className="error-icon"/>
              <Typography variant="h5" component="h2" className="error-title">
                {t('OAUTH_ERROR_TITLE')}
              </Typography>
              <Typography color="text.secondary">
                {t(messageKey)}
              </Typography>
              {description && (
                <Typography variant="body2" color="text.secondary" className="error-description">
                  {description}
                </Typography>
              )}
              <Button component={RouterLink} to="/" variant="outlined">
                {t('OAUTH_BACK_TO_MONEXA')}
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Container>
    </div>
  );
};

export default OAuthErrorPage;
