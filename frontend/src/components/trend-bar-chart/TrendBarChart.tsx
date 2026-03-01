import './trend-bar-chart.scss';
import { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import type { ChartEvent, ActiveElement, TooltipItem } from 'chart.js';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { enGB, mk } from 'date-fns/locale';
import { Language } from '../../enums/Language';
import { formatCurrencyAmount } from '../../utils/currency';
import type { MonthlyDataPoint } from '../../types/responses.ts';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface TrendBarChartProps {
  data: MonthlyDataPoint[];
  color: string;
  currency: string;
  height?: number;
  isLoading?: boolean;
  selectedMonth?: number | null;
  comparisonMonth?: number | null;
  onMonthClick?: (month: number) => void;
}

const TrendBarChart = ({ data, color, currency, height = 200, isLoading, selectedMonth, comparisonMonth, onMonthClick }: TrendBarChartProps) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const dateFnsLocale = i18n.language === Language.MK ? mk : enGB;
  const monthLabels = useMemo(
    () => Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), 'MMM', { locale: dateFnsLocale })),
    [dateFnsLocale],
  );

  const chartData = useMemo(() => {
    const errorColor = theme.palette.error.main;
    const disabledColor = theme.palette.action.disabledBackground;
    const amounts = data.map(d => d.amount);
    const hasSelection = selectedMonth != null;

    const bgColors = amounts.map((a, i) => {
      const month = i + 1;
      if (hasSelection && month === selectedMonth) return a < 0 ? errorColor : color;
      if (hasSelection && month === comparisonMonth) return (a < 0 ? errorColor : color) + '40';
      if (hasSelection) return disabledColor;
      return a < 0 ? errorColor : color;
    });
    const hoverColors = amounts.map((a, i) => {
      const month = i + 1;
      if (hasSelection && month === selectedMonth) return (a < 0 ? errorColor : color) + 'cc';
      if (hasSelection && month === comparisonMonth) return (a < 0 ? errorColor : color) + '60';
      if (hasSelection) return disabledColor;
      return a < 0 ? errorColor + 'cc' : color + 'cc';
    });

    return {
      labels: monthLabels,
      datasets: [
        {
          data: amounts,
          backgroundColor: bgColors,
          borderColor: bgColors,
          borderWidth: 0,
          borderRadius: 4,
          hoverBackgroundColor: hoverColors,
        },
      ],
    };
  }, [data, color, selectedMonth, comparisonMonth, theme.palette.error.main, theme.palette.action.disabledBackground, monthLabels]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    onClick: onMonthClick
      ? (_event: ChartEvent, elements: ActiveElement[]) => {
          if (elements.length > 0) {
            onMonthClick(elements[0].index + 1);
          }
        }
      : undefined,
    onHover: onMonthClick
      ? (event: ChartEvent, elements: ActiveElement[]) => {
          const canvas = event.native?.target as HTMLCanvasElement | undefined;
          if (canvas) {
            canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
          }
        }
      : undefined,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.primary,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: { top: 8, bottom: 8, left: 12, right: 12 },
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            return ` ${formatCurrencyAmount(context.raw as number, currency)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: theme.palette.text.secondary,
          font: { size: 11 },
        },
        border: { display: false },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: theme.palette.text.secondary,
          font: { size: 11 },
          callback: (value: number | string) =>
            formatCurrencyAmount(Number(value), currency, 0),
        },
        border: { display: false },
      },
    },
  }), [currency, onMonthClick, theme.palette.background.paper, theme.palette.text.primary, theme.palette.text.secondary]);

  if (isLoading) {
    return <Box className="trend-bar-chart-placeholder" style={{ height }}/>;
  }

  const hasData = data.some(d => d.amount !== 0);

  if (!hasData) {
    return (
      <Box className="trend-bar-chart-empty" style={{ height }}>
        <Typography variant="body2" color="text.secondary">
          {t('NO_DATA_FOR_PERIOD')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="trend-bar-chart" style={{ height }}>
      <Bar data={chartData} options={chartOptions}/>
    </Box>
  );
};

export default TrendBarChart;
