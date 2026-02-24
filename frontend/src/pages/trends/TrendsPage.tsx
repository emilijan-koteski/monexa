import './trends-page.scss';
import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, CircularProgress, Container, MenuItem, Select, Stack, Typography, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import { useTrendReports, useCreateTrendReport, useTrendReportMonthlyData } from '../../services/trendReportService';
import type { TrendReport } from '../../types/models';
import TrendReportDialog, { type TrendReportFormData } from '../../components/trend-report-dialog/TrendReportDialog';
import TrendBarChart from '../../components/trend-bar-chart/TrendBarChart';

type YearPreset = 'THIS_YEAR' | 'LAST_YEAR' | 'CUSTOM';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - i);

function getReportDisplayName(report: TrendReport): string {
  if (report.title) return report.title;
  return report.categories.map(c => c.name).join(', ');
}

function ReportCard({ report, year, yearPreset }: { report: TrendReport; year: number; yearPreset: string }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: monthlyData, isLoading } = useTrendReportMonthlyData(report.id, year);

  const displayName = getReportDisplayName(report);
  const color = report.color || theme.palette.secondary.main;

  return (
    <Card className="report-card" variant="outlined">
      <CardContent className="report-card-content">
        <Box
          className="report-card-header"
          onClick={() => navigate(`/trends/${report.id}?yearPreset=${yearPreset}&year=${year}`)}
        >
          <Typography variant="subtitle1" fontWeight={600} className="report-title">
            {displayName}
          </Typography>
          <FontAwesomeIcon icon={faChevronRight} className="chevron-icon" />
        </Box>
        <TrendBarChart
          data={monthlyData?.data ?? Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }))}
          color={color}
          currency={monthlyData?.currency ?? 'MKD'}
          height={150}
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  );
}

const TrendsPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const presetParam = (searchParams.get('yearPreset') as YearPreset) || 'THIS_YEAR';
  const yearParam = searchParams.get('year');

  const [yearPreset, setYearPreset] = useState<YearPreset>(presetParam);
  const [customYear, setCustomYear] = useState<number>(
    yearParam ? parseInt(yearParam) : CURRENT_YEAR,
  );

  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: reports, isLoading } = useTrendReports();
  const createMutation = useCreateTrendReport();

  const getActiveYear = (): number => {
    if (yearPreset === 'THIS_YEAR') return CURRENT_YEAR;
    if (yearPreset === 'LAST_YEAR') return CURRENT_YEAR - 1;
    return customYear;
  };

  const activeYear = getActiveYear();

  const updateUrlParams = (preset: YearPreset, year: number) => {
    setSearchParams(
      { yearPreset: preset, year: year.toString() },
      { replace: true },
    );
  };

  const handlePresetChange = (preset: YearPreset) => {
    setYearPreset(preset);
    const year =
      preset === 'THIS_YEAR'
        ? CURRENT_YEAR
        : preset === 'LAST_YEAR'
          ? CURRENT_YEAR - 1
          : customYear;
    updateUrlParams(preset, year);
  };

  const handleCustomYearChange = (year: number) => {
    setCustomYear(year);
    updateUrlParams('CUSTOM', year);
  };

  const handleDialogSubmit = async (data: TrendReportFormData) => {
    try {
      await createMutation.mutateAsync({
        title: data.title || undefined,
        description: data.description || undefined,
        color: data.color || undefined,
        categoryIds: data.categoryIds,
      });
      toast.success(t('TREND_REPORT_CREATED_SUCCESS'));
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('TREND_REPORT_SAVE_ERROR'));
    }
  };

  const sortedReports = [...(reports ?? [])].sort((a, b) =>
    getReportDisplayName(a).localeCompare(getReportDisplayName(b)),
  );

  return (
    <>
      <Container maxWidth="md" id="trends-page">
        <Box className="page-header">
          <Typography variant="h5" color="text.primary" fontWeight="600" className="page-title">
            {t('TRENDS')}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setDialogOpen(true)}
            className="add-button"
            startIcon={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('NEW')}
          </Button>
        </Box>

        <Box className="year-filter">
          <Chip
            label={t('THIS_YEAR')}
            color={yearPreset === 'THIS_YEAR' ? 'primary' : 'default'}
            onClick={() => handlePresetChange('THIS_YEAR')}
          />
          <Chip
            label={t('LAST_YEAR')}
            color={yearPreset === 'LAST_YEAR' ? 'primary' : 'default'}
            onClick={() => handlePresetChange('LAST_YEAR')}
          />
          <Chip
            label={t('CUSTOM')}
            color={yearPreset === 'CUSTOM' ? 'primary' : 'default'}
            onClick={() => handlePresetChange('CUSTOM')}
          />
          {yearPreset === 'CUSTOM' && (
            <Select
              value={customYear}
              onChange={(e) => handleCustomYearChange(Number(e.target.value))}
              size="small"
              className="year-select"
            >
              {YEAR_OPTIONS.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          )}
        </Box>

        {isLoading ? (
          <Box className="loading-container">
            <CircularProgress />
          </Box>
        ) : sortedReports.length > 0 ? (
          <Stack gap={2} className="reports-list">
            {sortedReports.map((report) => (
              <ReportCard key={report.id} report={report} year={activeYear} yearPreset={yearPreset} />
            ))}
          </Stack>
        ) : (
          <Stack gap={1} className="empty-state">
            <Typography variant="h6" color="text.primary" fontWeight="bold">
              {t('NO_TREND_REPORTS_TITLE')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('NO_TREND_REPORTS_MESSAGE')}
            </Typography>
          </Stack>
        )}
      </Container>

      <TrendReportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        isLoading={createMutation.isPending}
      />
    </>
  );
};

export default TrendsPage;
