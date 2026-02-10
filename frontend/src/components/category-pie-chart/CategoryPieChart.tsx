import './category-pie-chart.scss';
import { useMemo, useState } from 'react';
import { Box, Typography, Stack, ToggleButton, ToggleButtonGroup, useTheme } from '@mui/material';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import type { CategoryStatItem } from '../../types/models';
import { CategoryType } from '../../enums/CategoryType';
import { formatCurrencyAmount } from '../../utils/currency';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryPieChartProps {
  categories: CategoryStatItem[];
  currency: string;
  isLoading?: boolean;
}

type ChartView = 'all' | 'income' | 'expense';

const DEFAULT_COLORS = [
  '#FF5733', '#4EFF33', '#33CFFF', '#FF33A8', '#FF3333',
  '#FF9F33', '#F433FF', '#33FFD1', '#A833FF', '#FFD733',
  '#33FF57', '#8A8A8A', '#33FFB5',
];

const CategoryPieChart = ({ categories, currency, isLoading }: CategoryPieChartProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [chartView, setChartView] = useState<ChartView>('all');

  const filteredCategories = useMemo(() => {
    if (chartView === 'all') return categories;
    return categories.filter(cat =>
      chartView === 'income'
        ? cat.categoryType === CategoryType.INCOME
        : cat.categoryType === CategoryType.EXPENSE
    );
  }, [categories, chartView]);

  const totalAmount = useMemo(() => {
    return filteredCategories.reduce((sum, cat) => sum + Math.abs(cat.totalAmount), 0);
  }, [filteredCategories]);

  const chartData = useMemo(() => {
    if (!filteredCategories.length) return null;

    const labels = filteredCategories.map(cat => cat.categoryName);
    const data = filteredCategories.map(cat => Math.abs(cat.totalAmount));
    const backgroundColor = filteredCategories.map((cat, index) =>
      cat.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
    );

    return {
      labels,
      datasets: [{
        data,
        backgroundColor,
        borderColor: 'rgba(30, 30, 30, 0.8)',
        borderWidth: 2,
        hoverBorderColor: '#fff',
        hoverBorderWidth: 2,
      }],
    };
  }, [filteredCategories]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 12,
          },
          generateLabels: (chart: ChartJS) => {
            const data = chart.data;
            if (!data.labels || !data.datasets.length) return [];

            const meta = chart.getDatasetMeta(0);

            return data.labels.map((label, i) => {
              const dataset = data.datasets[0];
              const value = dataset.data[i] as number;
              const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : '0';
              const bgColor = Array.isArray(dataset.backgroundColor)
                ? dataset.backgroundColor[i]
                : dataset.backgroundColor;
              const isHidden = (meta.data[i] as unknown as { hidden?: boolean })?.hidden || false;

              return {
                text: `${label} (${percentage}%)`,
                fillStyle: isHidden ? theme.palette.text.disabled : bgColor as string,
                strokeStyle: isHidden ? theme.palette.text.disabled : bgColor as string,
                fontColor: isHidden ? theme.palette.text.disabled : theme.palette.text.primary,
                lineWidth: 0,
                hidden: false,
                index: i,
                datasetIndex: 0,
              };
            });
          },
        },
        onClick: (_event: unknown, legendItem: { index?: number }, legend: { chart: ChartJS }) => {
          const chart = legend.chart;
          const index = legendItem.index;
          if (index === undefined) return;

          const meta = chart.getDatasetMeta(0);
          const item = meta.data[index] as unknown as { hidden?: boolean };
          if (item) {
            item.hidden = !item.hidden;
          }
          chart.update();
        },
      },
      tooltip: {
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.primary,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: { top: 8, bottom: 8, left: 12, right: 12 },
        cornerRadius: 8,
        displayColors: true,
        bodyFont: {
          size: 14,
        },
        callbacks: {
          label: (context: TooltipItem<'doughnut'>) => {
            const value = context.raw as number;
            const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : '0';
            return ` ${formatCurrencyAmount(value, currency)} (${percentage}%)`;
          },
        },
      },
    },
  }), [totalAmount, currency, theme.palette.text.disabled, theme.palette.text.primary, theme.palette.background.paper]);

  const handleViewChange = (_: React.MouseEvent<HTMLElement>, newView: ChartView | null) => {
    if (newView !== null) {
      setChartView(newView);
    }
  };

  if (isLoading || !categories.length) {
    return null;
  }

  return (
    <Box id="category-pie-chart">
      <Box className="chart-header">
        <Typography variant="overline" color="text.secondary" className="section-title">
          {t('CATEGORY_BREAKDOWN')}
        </Typography>
        <ToggleButtonGroup
          value={chartView}
          exclusive
          onChange={handleViewChange}
          size="small"
          className="view-toggle"
        >
          <ToggleButton value="all">{t('ALL')}</ToggleButton>
          <ToggleButton value="income">{t('INCOME')}</ToggleButton>
          <ToggleButton value="expense">{t('EXPENSE')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {filteredCategories.length > 0 && chartData ? (
        <Box className="chart-wrapper">
          <Doughnut data={chartData} options={chartOptions} />
        </Box>
      ) : (
        <Stack className="empty-state" alignItems="center" justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            {t('NO_CATEGORY_DATA')}
          </Typography>
        </Stack>
      )}
    </Box>
  );
};

export default CategoryPieChart;
