import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { usePendingDocuments, useAcceptDocument } from '../../services/legalDocumentService';
import { DocumentType } from '../../enums/DocumentType';
import { formatDate } from '../../utils/date';
import type { LegalDocument } from '../../types/models';
import LanguageChange from '../../components/language-change/LanguageChange';
import './legal-acceptance-page.scss';

const LegalAcceptancePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = usePendingDocuments();
  const acceptMutation = useAcceptDocument();

  const [activeStep, setActiveStep] = useState(0);
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});

  const initialDocsRef = useRef<LegalDocument[] | null>(null);

  useEffect(() => {
    if (data?.pendingDocuments && data.pendingDocuments.length > 0 && !initialDocsRef.current) {
      initialDocsRef.current = data.pendingDocuments;
    }
  }, [data?.pendingDocuments]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box py={4}>
          <Typography color="text.secondary">{t('LEGAL_DOCUMENT_LOAD_ERROR')}</Typography>
        </Box>
      </Container>
    );
  }

  const pendingDocs = initialDocsRef.current || data?.pendingDocuments || [];

  if (pendingDocs.length === 0) {
    const redirectPath = sessionStorage.getItem('redirectAfterLegal') || '/home';
    sessionStorage.removeItem('redirectAfterLegal');
    navigate(redirectPath, { replace: true });
    return null;
  }

  const currentDoc = pendingDocs[activeStep];
  const isLastStep = activeStep === pendingDocs.length - 1;
  const canProceed = accepted[currentDoc.id];

  const handleAccept = async () => {
    try {
      await acceptMutation.mutateAsync(currentDoc.id);

      if (isLastStep) {
        toast.success(t('LEGAL_DOCUMENTS_ACCEPTED_SUCCESS'));
        await refetch();
        const redirectPath = sessionStorage.getItem('redirectAfterLegal') || '/home';
        sessionStorage.removeItem('redirectAfterLegal');
        navigate(redirectPath, { replace: true });
      } else {
        setActiveStep((prev) => prev + 1);
      }
    } catch {
      toast.error(t('LEGAL_DOCUMENT_ACCEPT_ERROR'));
    }
  };

  const getDocumentTypeLabel = (type: DocumentType) => {
    switch (type) {
      case DocumentType.PRIVACY_POLICY:
        return t('PRIVACY_POLICY');
      case DocumentType.TERMS_OF_SERVICE:
        return t('TERMS_OF_SERVICE');
      default:
        return type;
    }
  };

  return (
    <div id="legal-acceptance-page">
      <Container maxWidth="md" className="page-container">
        <Paper className="acceptance-paper">
          <Box className="acceptance-header">
            <Stack gap={1}>
              <Typography variant="h4" fontWeight={600}>
                {t('LEGAL_DOCUMENTS_REQUIRED_TITLE')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('LEGAL_DOCUMENTS_REQUIRED_MESSAGE')}
              </Typography>
            </Stack>
            <LanguageChange />
          </Box>

          {pendingDocs.length > 1 && (
            <Stepper activeStep={activeStep} className="acceptance-stepper">
              {pendingDocs.map((doc) => (
                <Step key={doc.id}>
                  <StepLabel>{getDocumentTypeLabel(doc.type)}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          <Box className="document-section">
            <Typography variant="h5" fontWeight={600}>
              {t(currentDoc.type)}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={1}>
              {t('VERSION')}: {currentDoc.version} | {t('EFFECTIVE')}: {formatDate(currentDoc.effectiveAt)}
            </Typography>

            <Box
              className="document-content"
              dangerouslySetInnerHTML={{ __html: currentDoc.content }}
            />
          </Box>

          <Box className="acceptance-footer">
            <FormControlLabel
              control={
                <Checkbox
                  checked={accepted[currentDoc.id] || false}
                  onChange={(e) => setAccepted({ ...accepted, [currentDoc.id]: e.target.checked })}
                />
              }
              label={t('LEGAL_DOCUMENT_ACCEPT_CHECKBOX', { title: t(currentDoc.type) })}
              className="accept-checkbox"
            />

            <Box display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                size="large"
                onClick={handleAccept}
                disabled={!canProceed || acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <CircularProgress size={20} color="inherit" />
                ) : isLastStep ? (
                  t('ACCEPT_AND_CONTINUE')
                ) : (
                  t('ACCEPT_AND_NEXT')
                )}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </div>
  );
};

export default LegalAcceptancePage;
