import './trend-details-page.scss';
import { useEffect, useState } from 'react';
import { Box, CircularProgress, Container, IconButton, Stack, ToggleButton, ToggleButtonGroup, Typography, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { enGB, mk } from 'date-fns/locale';
import { useDeleteTrendReport, useTrendReport, useTrendReportMonthlyData, useTrendReportMonthlyDetails, useUpdateTrendReport } from '../../../services/trendReportService';
import TrendReportDialog, { type TrendReportFormData } from '../../../components/trend-report-dialog/TrendReportDialog';
import ConfirmationDialog from '../../../components/confirmation-dialog/ConfirmationDialog';
import TrendBarChart from '../../../components/trend-bar-chart/TrendBarChart';
import TrendMonthlyBreakdown from '../../../components/trend-monthly-breakdown/TrendMonthlyBreakdown';
import MonthSummary from '../../../components/month-summary/MonthSummary';
import { CategoryType } from '../../../enums/CategoryType';
import { Currency } from '../../../enums/Currency';
import { Language } from '../../../enums/Language';
import { formatCurrencyAmount } from '../../../utils/currency';
import { getReportDisplayName } from '../utils/getReportDisplayName';
import { CURRENT_YEAR, CURRENT_MONTH } from '../constants/date';
import { calcComparison } from '../utils/calcComparison';

const TrendDetailsPage = () => {
  const { t, i18n } = useTranslation();
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
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [comparisonMonth, setComparisonMonth] = useState<number | null>(null);
  const [comparisonLocked, setComparisonLocked] = useState(false);
  const [activeType, setActiveType] = useState<CategoryType>(CategoryType.EXPENSE);

  const { data: report, isLoading: reportLoading } = useTrendReport(id);
  const updateMutation = useUpdateTrendReport();
  const deleteMutation = useDeleteTrendReport();

  const hasExpenseCategories = report?.categories.some(c => c.type === CategoryType.EXPENSE) ?? false;
  const hasIncomeCategories = report?.categories.some(c => c.type === CategoryType.INCOME) ?? false;

  useEffect(() => {
    if (report) {
      const hasExpense = report.categories.some(c => c.type === CategoryType.EXPENSE);
      setActiveType(hasExpense ? CategoryType.EXPENSE : CategoryType.INCOME);
    }
  }, [report]);

  const { data: monthlyData, isLoading: dataLoading } = useTrendReportMonthlyData(id, activeYear, activeType);
  const { data: monthlyDetails, isLoading: detailsLoading } = useTrendReportMonthlyDetails(id, activeYear, activeType);

  const dateFnsLocale = i18n.language === Language.MK ? mk : enGB;

  const findDefaultComparison = (selected: number, data: { month: number; amount: number }[]): number | null => {
    const others = data.filter(d => d.month !== selected && d.amount !== 0);
    if (others.length === 0) return null;

    const before = others.filter(d => d.month < selected).sort((a, b) => b.month - a.month);
    if (before.length > 0) return before[0].month;

    const after = others.filter(d => d.month > selected).sort((a, b) => a.month - b.month);
    if (after.length > 0) return after[0].month;

    return null;
  };

  useEffect(() => {
    if (!monthlyData) return;

    const isCurrentYear = activeYear === CURRENT_YEAR;
    let defaultMonth: number;

    if (isCurrentYear) {
      defaultMonth = CURRENT_MONTH;
    } else {
      defaultMonth = 12;
      for (let m = 12; m >= 1; m--) {
        const point = monthlyData.data.find(d => d.month === m);
        if (point && point.amount !== 0) {
          defaultMonth = m;
          break;
        }
      }
    }

    setSelectedMonth(defaultMonth);
    setComparisonLocked(false);
    setComparisonMonth(findDefaultComparison(defaultMonth, monthlyData.data));
  }, [monthlyData, activeYear]);

  const handleTypeChange = (_: React.MouseEvent<HTMLElement>, newType: CategoryType | null) => {
    if (newType === null) return;
    setActiveType(newType);
    setSelectedMonth(null);
    setComparisonMonth(null);
    setComparisonLocked(false);
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);

    if (comparisonLocked && comparisonMonth === month) {
      setComparisonLocked(false);
      setComparisonMonth(monthlyData ? findDefaultComparison(month, monthlyData.data) : null);
    } else if (!comparisonLocked) {
      setComparisonMonth(monthlyData ? findDefaultComparison(month, monthlyData.data) : null);
    }
  };

  const handleLockToggle = () => {
    const newLocked = !comparisonLocked;
    setComparisonLocked(newLocked);
    if (!newLocked && monthlyData && selectedMonth !== null) {
      setComparisonMonth(findDefaultComparison(selectedMonth, monthlyData.data));
    }
  };

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

  const selectedPoint = monthlyData?.data.find(d => d.month === selectedMonth);
  const comparisonPoint = monthlyData?.data.find(d => d.month === comparisonMonth);
  const selectedAmount = selectedPoint?.amount ?? 0;
  const comparisonAmount = comparisonPoint?.amount ?? 0;
  const comparison = comparisonMonth !== null && selectedPoint !== undefined
    ? calcComparison(selectedAmount, comparisonAmount, activeType)
    : null;

  const comparisonOptions = monthlyData?.data.filter(d => d.month !== selectedMonth) ?? [];

  const selectedMonthLabel = selectedMonth ? format(new Date(activeYear, selectedMonth - 1, 1), 'MMMM yyyy', { locale: dateFnsLocale }) : '';

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

          <ToggleButtonGroup
            value={activeType}
            exclusive
            onChange={handleTypeChange}
            size="small"
            className="view-toggle"
          >
            {hasExpenseCategories && (
              <ToggleButton value={CategoryType.EXPENSE}>{t('EXPENSE')}</ToggleButton>
            )}
            {hasIncomeCategories && (
              <ToggleButton value={CategoryType.INCOME}>{t('INCOME')}</ToggleButton>
            )}
          </ToggleButtonGroup>

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

        {selectedMonth !== null && !dataLoading && (
          <MonthSummary
            monthLabel={selectedMonthLabel}
            amount={formatCurrencyAmount(selectedAmount, monthlyData?.currency ?? Currency.MKD)}
            comparison={comparison}
            comparisonMonth={comparisonMonth}
            comparisonOptions={comparisonOptions.map(opt => ({
              value: opt.month,
              label: format(new Date(activeYear, opt.month - 1, 1), 'MMMM', { locale: dateFnsLocale }),
            }))}
            comparisonLocked={comparisonLocked}
            onComparisonChange={month => setComparisonMonth(month)}
            onLockToggle={handleLockToggle}
          />
        )}

        <Stack gap={1}>
          <TrendBarChart
            data={monthlyData?.data ?? Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }))}
            color={color}
            currency={monthlyData?.currency ?? Currency.MKD}
            height={300}
            isLoading={dataLoading}
            selectedMonth={selectedMonth}
            comparisonMonth={comparisonMonth}
            onMonthClick={handleMonthClick}
          />
        </Stack>

        <TrendMonthlyBreakdown
          monthlyDetails={monthlyDetails}
          selectedMonth={selectedMonth}
          comparisonMonth={comparisonMonth}
          activeType={activeType}
          currency={monthlyData?.currency ?? Currency.MKD}
          year={activeYear}
          isLoading={detailsLoading}
        />
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
