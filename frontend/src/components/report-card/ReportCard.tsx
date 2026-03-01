import './report-card.scss';
import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router';
import { useTrendReportMonthlyData } from '../../services/trendReportService';
import type { TrendReport } from '../../types/models';
import TrendBarChart from '../trend-bar-chart/TrendBarChart';
import { Currency } from '../../enums/Currency';
import { getReportDisplayName } from '../../pages/trends/utils/getReportDisplayName';

interface ReportCardProps {
  report: TrendReport;
  year: number;
  yearPreset: string;
}

const ReportCard = ({ report, year, yearPreset }: ReportCardProps) => {
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
          currency={monthlyData?.currency ?? Currency.MKD}
          height={150}
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  );
};

export default ReportCard;
