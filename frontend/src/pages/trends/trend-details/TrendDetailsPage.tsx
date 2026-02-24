import './trend-details-page.scss';
import { useState } from 'react';
import { Box, CircularProgress, Container, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import { useDeleteTrendReport, useTrendReport, useTrendReportMonthlyData, useUpdateTrendReport } from '../../../services/trendReportService';
import type { TrendReport } from '../../../types/models';
import TrendReportDialog, { type TrendReportFormData } from '../../../components/trend-report-dialog/TrendReportDialog';
import ConfirmationDialog from '../../../components/confirmation-dialog/ConfirmationDialog';
import TrendBarChart from '../../../components/trend-bar-chart/TrendBarChart';

const CURRENT_YEAR = new Date().getFullYear();

function getReportDisplayName(report: TrendReport): string {
  if (report.title) return report.title;
  return report.categories.map(c => c.name).join(', ');
}

const TrendDetailsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { reportId } = useParams<{ reportId: string }>();
  const [searchParams] = useSearchParams();

  const id = reportId ? parseInt(reportId) : 0;

  const yearParam = searchParams.get('year');
  const yearPresetParam = searchParams.get('yearPreset') ?? 'THIS_YEAR';
  const activeYear = yearParam ? parseInt(yearParam) : CURRENT_YEAR;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: report, isLoading: reportLoading } = useTrendReport(id);
  const updateMutation = useUpdateTrendReport();
  const deleteMutation = useDeleteTrendReport();

  const { data: monthlyData, isLoading: dataLoading } = useTrendReportMonthlyData(id, activeYear);

  const handleBack = () => {
    navigate(`/trends?yearPreset=${yearPresetParam}&year=${activeYear}`);
  };

  const handleEditSubmit = async (data: TrendReportFormData) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          title: data.title || undefined,
          description: data.description || undefined,
          color: data.color || undefined,
          categoryIds: data.categoryIds,
        },
      });
      toast.success(t('TREND_REPORT_UPDATED_SUCCESS'));
      setEditDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('TREND_REPORT_SAVE_ERROR'));
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('TREND_REPORT_DELETED_SUCCESS'));
      setDeleteDialogOpen(false);
      navigate('/trends');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('TREND_REPORT_DELETE_ERROR'));
    }
  };

  if (reportLoading) {
    return (
      <Container maxWidth="md" className="loading-container">
        <CircularProgress/>
      </Container>
    );
  }

  if (!report) return null;

  const displayName = getReportDisplayName(report);
  const color = report.color || theme.palette.secondary.main;

  return (
    <>
      <Container maxWidth="md" id="trend-details-page">
        <Box className="page-header">
          <IconButton color="primary" onClick={handleBack} className="back-button">
            <FontAwesomeIcon icon={faArrowLeft}/>
          </IconButton>
          <Typography variant="h5" color="text.primary" fontWeight="600" className="page-title">
            {displayName}
          </Typography>
          <Box className="action-buttons">
            <IconButton
              color="secondary"
              size="large"
              onClick={() => setEditDialogOpen(true)}
              disabled={updateMutation.isPending || deleteMutation.isPending}
            >
              <FontAwesomeIcon icon={faEdit} fontSize="medium"/>
            </IconButton>
            <IconButton
              color="error"
              size="large"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={updateMutation.isPending || deleteMutation.isPending}
            >
              <FontAwesomeIcon icon={faTrash} fontSize="medium"/>
            </IconButton>
          </Box>
        </Box>

        {report.description && (
          <Typography variant="body2" color="text.secondary" className="report-description">
            {report.description}
          </Typography>
        )}

        <Stack gap={1}>
          <TrendBarChart
            data={monthlyData?.data ?? Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }))}
            color={color}
            currency={monthlyData?.currency ?? 'MKD'}
            height={300}
            isLoading={dataLoading}
          />
        </Stack>
      </Container>

      <TrendReportDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSubmit={handleEditSubmit}
        report={report}
        isLoading={updateMutation.isPending}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
        title="DELETE_TREND_REPORT_TITLE"
        message="DELETE_TREND_REPORT_MESSAGE"
        confirmText="DELETE"
        confirmColor="error"
      />
    </>
  );
};

export default TrendDetailsPage;
