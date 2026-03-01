import './trends-page.scss';
import { useState } from 'react';
import { Box, Button, Chip, CircularProgress, Container, MenuItem, Select, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import { useTrendReports, useCreateTrendReport } from '../../services/trendReportService';
import TrendReportDialog, { type TrendReportFormData } from '../../components/trend-report-dialog/TrendReportDialog';
import ReportCard from '../../components/report-card/ReportCard';
import { getReportDisplayName } from './utils/getReportDisplayName';
import { YearPreset } from '../../enums/YearPreset';
import { CURRENT_YEAR, YEAR_OPTIONS } from './constants/date';

const TrendsPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const presetParam = (searchParams.get('yearPreset') as YearPreset) || YearPreset.THIS_YEAR;
  const yearParam = searchParams.get('year');

  const [yearPreset, setYearPreset] = useState<YearPreset>(presetParam);
  const [customYear, setCustomYear] = useState<number>(
    yearParam ? parseInt(yearParam) : CURRENT_YEAR,
  );

  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: reports, isLoading } = useTrendReports();
  const createMutation = useCreateTrendReport();

  const getActiveYear = (): number => {
    if (yearPreset === YearPreset.THIS_YEAR) return CURRENT_YEAR;
    if (yearPreset === YearPreset.LAST_YEAR) return CURRENT_YEAR - 1;
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
      preset === YearPreset.THIS_YEAR
        ? CURRENT_YEAR
        : preset === YearPreset.LAST_YEAR
          ? CURRENT_YEAR - 1
          : customYear;
    updateUrlParams(preset, year);
  };

  const handleCustomYearChange = (year: number) => {
    setCustomYear(year);
    updateUrlParams(YearPreset.CUSTOM, year);
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
            color={yearPreset === YearPreset.THIS_YEAR ? 'primary' : 'default'}
            onClick={() => handlePresetChange(YearPreset.THIS_YEAR)}
          />
          <Chip
            label={t('LAST_YEAR')}
            color={yearPreset === YearPreset.LAST_YEAR ? 'primary' : 'default'}
            onClick={() => handlePresetChange(YearPreset.LAST_YEAR)}
          />
          <Chip
            label={t('CUSTOM')}
            color={yearPreset === YearPreset.CUSTOM ? 'primary' : 'default'}
            onClick={() => handlePresetChange(YearPreset.CUSTOM)}
          />
          {yearPreset === YearPreset.CUSTOM && (
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
