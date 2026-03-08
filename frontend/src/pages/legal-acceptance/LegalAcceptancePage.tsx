import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, CircularProgress, Container, Divider, FormControlLabel, Paper, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faTrash } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { usePendingDocuments, useAcceptDocument } from '../../services/legalDocumentService';
import { useDeleteAccount } from '../../services/authService';
import { useDownloadData } from '../../services/userService';
import { DocumentType } from '../../enums/DocumentType';
import { formatDate } from '../../utils/date';
import type { LegalDocument } from '../../types/models';
import { getLocalizedTitle, getLocalizedContent } from '../../utils/legalDocument';
import LanguageChange from '../../components/language-change/LanguageChange';
import DownloadDataDialog from '../../components/download-data-dialog/DownloadDataDialog';
import ConfirmationDialog from '../../components/confirmation-dialog/ConfirmationDialog';
import './legal-acceptance-page.scss';

const LegalAcceptancePage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = usePendingDocuments();
  const acceptMutation = useAcceptDocument();

  const deleteAccountMutation = useDeleteAccount();
  const downloadMutation = useDownloadData();

  const [activeStep, setActiveStep] = useState(0);
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const initialDocsRef = useRef<LegalDocument[] | null>(null);

  useEffect(() => {
    if (data?.pendingDocuments && data.pendingDocuments.length > 0 && !initialDocsRef.current) {
      initialDocsRef.current = data.pendingDocuments;
    }
  }, [data?.pendingDocuments]);

  if (isLoading) {
    return (
      <div id="legal-acceptance-page">
        <div className="loading-container">
          <CircularProgress />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="legal-acceptance-page">
        <Container maxWidth="md" className="error-container">
          <Typography color="text.secondary">{t('LEGAL_DOCUMENT_LOAD_ERROR')}</Typography>
        </Container>
      </div>
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
        setIsRedirecting(true);
        toast.success(t('LEGAL_DOCUMENTS_ACCEPTED_SUCCESS'));
        await refetch();
        const redirectPath = sessionStorage.getItem('redirectAfterLegal') || '/home';
        sessionStorage.removeItem('redirectAfterLegal');
        navigate(redirectPath, { replace: true });
      } else {
        setActiveStep((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      toast.error(t('LEGAL_DOCUMENT_ACCEPT_ERROR'));
    }
  };

  const handleDownloadData = (startDate: Date | null, endDate: Date | null) => {
    downloadMutation.mutate(
      {
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `monexa-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success(t('DATA_DOWNLOAD_SUCCESS'));
          setIsDownloadDialogOpen(false);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t('DATA_DOWNLOAD_ERROR'));
        },
      }
    );
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('ACCOUNT_DELETED_SUCCESS'));
        setIsDeleteDialogOpen(false);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : t('ACCOUNT_DELETE_ERROR'));
      },
    });
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
          <Stack className="acceptance-header">
            <Stack className="header-text">
              <Typography variant="h4" fontWeight={600} className="header-title">
                {t('LEGAL_DOCUMENTS_REQUIRED_TITLE')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('LEGAL_DOCUMENTS_REQUIRED_MESSAGE')}
              </Typography>
            </Stack>
            <LanguageChange />
          </Stack>

          {pendingDocs.length > 1 && (
            <Stepper activeStep={activeStep} className="acceptance-stepper">
              {pendingDocs.map((doc) => (
                <Step key={doc.id}>
                  <StepLabel>{getDocumentTypeLabel(doc.type)}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          <Stack className="document-section">
            <Typography variant="h5" fontWeight={600}>
              {getLocalizedTitle(currentDoc, i18n.language)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('VERSION')}: {currentDoc.version} | {t('EFFECTIVE')}: {formatDate(currentDoc.effectiveAt)}
            </Typography>

            <div
              className="document-content"
              dangerouslySetInnerHTML={{ __html: getLocalizedContent(currentDoc, i18n.language) }}
            />
          </Stack>

          <Stack className="acceptance-footer">
            <FormControlLabel
              control={
                <Checkbox
                  checked={accepted[currentDoc.id] || false}
                  onChange={(e) => setAccepted({ ...accepted, [currentDoc.id]: e.target.checked })}
                />
              }
              label={t('LEGAL_DOCUMENT_ACCEPT_CHECKBOX', { title: getLocalizedTitle(currentDoc, i18n.language) })}
              className="accept-checkbox"
            />

            <Button
              variant="contained"
              size="large"
              onClick={handleAccept}
              disabled={!canProceed || acceptMutation.isPending || isRedirecting}
              className="accept-button"
            >
              {acceptMutation.isPending || isRedirecting ? (
                <CircularProgress size={26} color="inherit" />
              ) : isLastStep ? (
                t('ACCEPT_AND_CONTINUE')
              ) : (
                t('ACCEPT_AND_NEXT')
              )}
            </Button>
          </Stack>

          <Stack className="alternatives-section">
            <Divider className="alternatives-divider">
              <Typography variant="body2" color="text.secondary">
                {t('LEGAL_DECLINE_SECTION_TITLE')}
              </Typography>
            </Divider>
            <Typography variant="body2" color="text.secondary" className="alternatives-message">
              {t('LEGAL_DECLINE_SECTION_MESSAGE')}
            </Typography>
            <Stack className="alternatives-buttons">
              <Button
                variant="outlined"
                size="small"
                startIcon={<FontAwesomeIcon icon={faDownload} />}
                onClick={() => setIsDownloadDialogOpen(true)}
              >
                {t('DOWNLOAD_MY_DATA')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<FontAwesomeIcon icon={faTrash} />}
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                {t('DELETE_ACCOUNT')}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <DownloadDataDialog
          open={isDownloadDialogOpen}
          onClose={() => setIsDownloadDialogOpen(false)}
          onDownload={handleDownloadData}
          isLoading={downloadMutation.isPending}
        />

        <ConfirmationDialog
          open={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleDeleteAccount}
          title="DELETE_ACCOUNT_TITLE"
          message="DELETE_ACCOUNT_MESSAGE"
          confirmText="DELETE"
          confirmColor="error"
          isLoading={deleteAccountMutation.isPending}
        />
      </Container>
    </div>
  );
};

export default LegalAcceptancePage;
