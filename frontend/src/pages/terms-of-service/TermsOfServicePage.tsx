import { Box, CircularProgress, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDocumentByType } from '../../services/legalDocumentService';
import { DocumentType } from '../../enums/DocumentType';
import LanguageChange from '../../components/language-change/LanguageChange';
import { formatDate } from '../../utils/date';
import './terms-of-service-page.scss';

const TermsOfServicePage = () => {
  const { t } = useTranslation();
  const { data: document, isLoading, error } = useDocumentByType(DocumentType.TERMS_OF_SERVICE);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !document) {
    return (
      <Container maxWidth="md">
        <Box py={4}>
          <Typography color="text.secondary">{t('LEGAL_DOCUMENT_LOAD_ERROR')}</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <div id="terms-of-service-page">
      <Container maxWidth="md" className="page-container">
        <Paper className="document-paper">
          <Box className="document-header">
            <Stack gap={1.25}>
              <Typography variant="h4" className="document-title">
                {t(document.type)}
              </Typography>
              <Typography variant="body2" className="document-meta">
                {t('VERSION')}: {document.version} | {t('EFFECTIVE')}: {formatDate(document.effectiveAt)}
              </Typography>
            </Stack>
            <LanguageChange />
          </Box>
          <Divider className="document-divider" />
          <Box
            className="document-content"
            dangerouslySetInnerHTML={{ __html: document.content }}
          />
        </Paper>
      </Container>
    </div>
  );
};

export default TermsOfServicePage;
