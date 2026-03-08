import { CircularProgress, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDocumentByType } from '../../services/legalDocumentService';
import { DocumentType } from '../../enums/DocumentType';
import LanguageChange from '../../components/language-change/LanguageChange';
import { formatDate } from '../../utils/date';
import { getLocalizedTitle, getLocalizedContent } from '../../utils/legalDocument';
import './terms-of-service-page.scss';

const TermsOfServicePage = () => {
  const { t, i18n } = useTranslation();
  const { data: document, isLoading, error } = useDocumentByType(DocumentType.TERMS_OF_SERVICE);

  if (isLoading) {
    return (
      <div id="terms-of-service-page">
        <div className="loading-container">
          <CircularProgress />
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div id="terms-of-service-page">
        <Container maxWidth="md" className="error-container">
          <Typography color="text.secondary">{t('LEGAL_DOCUMENT_LOAD_ERROR')}</Typography>
        </Container>
      </div>
    );
  }

  return (
    <div id="terms-of-service-page">
      <Container maxWidth="md" className="page-container">
        <Paper className="document-paper">
          <Stack className="document-header">
            <Stack className="header-text">
              <Typography variant="h4" fontWeight={600} className="document-title">
                {getLocalizedTitle(document, i18n.language)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('VERSION')}: {document.version} | {t('EFFECTIVE')}: {formatDate(document.effectiveAt)}
              </Typography>
            </Stack>
            <LanguageChange />
          </Stack>
          <Divider className="document-divider" />
          <div
            className="document-content"
            dangerouslySetInnerHTML={{ __html: getLocalizedContent(document, i18n.language) }}
          />
        </Paper>
      </Container>
    </div>
  );
};

export default TermsOfServicePage;
