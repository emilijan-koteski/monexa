import './trend-monthly-breakdown.scss';
import { useMemo } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { enGB, mk } from 'date-fns/locale';
import { CategoryType } from '../../enums/CategoryType';
import { Language } from '../../enums/Language';
import { formatCurrencyAmount } from '../../utils/currency';
import type { TrendReportMonthlyDetails, MonthlyDetailItem } from '../../types/responses';

interface TrendMonthlyBreakdownProps {
  monthlyDetails: TrendReportMonthlyDetails | undefined;
  selectedMonth: number | null;
  comparisonMonth: number | null;
  activeType: CategoryType;
  currency: string;
  year: number;
  isLoading: boolean;
}

function TrendMonthlyBreakdown({ monthlyDetails, selectedMonth, comparisonMonth, activeType, currency, year, isLoading }: TrendMonthlyBreakdownProps) {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language === Language.MK ? mk : enGB;

  const monthsWithData = useMemo(() => {
    if (!monthlyDetails) return [];
    return monthlyDetails.data
      .filter(group => group.items.length > 0)
      .sort((a, b) => b.month - a.month);
  }, [monthlyDetails]);

  const comparisonItemsMap = useMemo(() => {
    if (!monthlyDetails || comparisonMonth === null) return new Map<string, number>();
    const compGroup = monthlyDetails.data.find(g => g.month === comparisonMonth);
    if (!compGroup) return new Map<string, number>();

    const map = new Map<string, number>();
    for (const item of compGroup.items) {
      const key = `${item.categoryId}_${item.label}_${item.isUngrouped}`;
      map.set(key, item.amount);
    }
    return map;
  }, [monthlyDetails, comparisonMonth]);

  const comparisonMonthName = useMemo(() => {
    if (comparisonMonth === null) return '';
    return format(new Date(year, comparisonMonth - 1, 1), 'MMMM', { locale: dateFnsLocale });
  }, [comparisonMonth, year, dateFnsLocale]);

  const getItemKey = (item: MonthlyDetailItem) =>
    `${item.categoryId}_${item.label}_${item.isUngrouped}`;

  const getDiffSentiment = (diff: number): string => {
    if (diff === 0) return 'neutral';
    const isPositive = diff > 0;
    if (activeType === CategoryType.EXPENSE) {
      return isPositive ? 'bad' : 'good';
    }
    return isPositive ? 'good' : 'bad';
  };

  if (isLoading) {
    return (
      <Box className="trend-monthly-breakdown">
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (monthsWithData.length === 0) return null;

  return (
    <Box className="trend-monthly-breakdown">
      <Stack gap={2}>
        {monthsWithData.map(group => {
          const monthName = format(new Date(year, group.month - 1, 1), 'MMMM yyyy', { locale: dateFnsLocale });

          return (
            <Box key={group.month} className="month-group">
              <Typography variant="overline" className="month-header" fontWeight={600} color="text.secondary" letterSpacing="0.1em">
                {monthName}
              </Typography>
              <Box className={`detail-items-container${group.month === selectedMonth ? ' selected' : ''}`}>
                {group.items.map((item, idx) => {
                  const itemKey = getItemKey(item);
                  const comparisonAmount = comparisonItemsMap.get(itemKey);
                  const hasDiff = comparisonMonth !== null && comparisonAmount !== undefined;
                  const diff = hasDiff ? item.amount - comparisonAmount : null;

                  return (
                    <Box key={`${itemKey}-${idx}`} className="detail-item">
                      <Box className="detail-item-left">
                        <Typography variant="body2" className="detail-label" fontWeight={500} noWrap>
                          {item.isUngrouped ? (
                            <>{item.categoryName} <span className="detail-label-suffix">({t('UNGROUPED')})</span></>
                          ) : (
                            item.label
                          )}
                        </Typography>
                        {comparisonMonth !== null && (
                          <Typography variant="caption" className="detail-comparison-label" color="text.secondary" fontSize="0.7rem">
                            {t('COMPARED_TO')} {comparisonMonthName}
                          </Typography>
                        )}
                      </Box>
                      <Box className="detail-item-right">
                        <Typography variant="body2" className="detail-amount" fontWeight={600}>
                          {formatCurrencyAmount(item.amount, currency)}
                        </Typography>
                        {diff !== null && diff !== 0 && (
                          <Typography variant="caption" className={`detail-diff ${getDiffSentiment(diff)}`} fontSize="0.7rem" fontWeight={500}>
                            {diff > 0 ? '+' : '-'}{formatCurrencyAmount(Math.abs(diff), currency)}
                          </Typography>
                        )}
                        {diff !== null && diff === 0 && (
                          <Typography variant="caption" className="detail-diff neutral" fontSize="0.7rem" fontWeight={500}>
                            -
                          </Typography>
                        )}
                        {diff === null && comparisonMonth !== null && (
                          <Typography variant="caption" className="detail-diff neutral" fontSize="0.7rem" fontWeight={500}>
                            {t('NO_DATA_AVAILABLE')}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

export default TrendMonthlyBreakdown;
