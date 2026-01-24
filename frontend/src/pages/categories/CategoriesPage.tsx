import './categories-page.scss';
import { useState, useMemo } from 'react';
import { Box, Container, Typography, TextField, InputAdornment, List, ListItem, ListItemButton, Stack, CircularProgress } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { DateRangePreset } from '../../enums/DateRangePreset';
import { useCategoryStatistics } from '../../services/categoryStatisticsService';
import { useDebounce } from '../../hooks/useDebounce';
import DateRangeFilter from '../../components/date-range-filter/DateRangeFilter';
import PaymentMethodFilter from '../../components/payment-method-filter/PaymentMethodFilter';
import BalanceSummary from '../../components/balance-summary/BalanceSummary';
import CategoryStatItem from '../../components/category-stat-item/CategoryStatItem';

const CategoriesPage = () => {
  const { t } = useTranslation();

  const [datePreset, setDatePreset] = useState<DateRangePreset>(DateRangePreset.ONE_MONTH);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [paymentMethodIds, setPaymentMethodIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();

    switch (datePreset) {
      case DateRangePreset.OVERALL:
        return { startDate: undefined, endDate: undefined };
      case DateRangePreset.ONE_WEEK:
        return {
          startDate: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
          endDate: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        };
      case DateRangePreset.ONE_MONTH:
        return {
          startDate: format(startOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
          endDate: format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        };
      case DateRangePreset.ONE_YEAR:
        return {
          startDate: format(startOfYear(now), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
          endDate: format(endOfYear(now), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        };
      case DateRangePreset.CUSTOM:
        return {
          startDate: customStartDate ? format(customStartDate, "yyyy-MM-dd'T'HH:mm:ss'Z'") : undefined,
          endDate: customEndDate ? format(customEndDate, "yyyy-MM-dd'T'HH:mm:ss'Z'") : undefined,
        };
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [datePreset, customStartDate, customEndDate]);

  const { data: statistics, isLoading } = useCategoryStatistics({
    startDate,
    endDate,
    paymentMethodIds: paymentMethodIds.length > 0 ? paymentMethodIds : undefined,
    search: debouncedSearch || undefined,
  });

  const handleCustomDateChange = (start: Date | null, end: Date | null) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  return (
    <Container maxWidth="md" id="categories-page">
      <Box className="categories-header">
        <Typography variant="h4" color="text.primary" fontWeight="600" className="categories-title">
          {t('CATEGORIES')}
        </Typography>
      </Box>

      {/* Filters Section */}
      <Box className="filters-section">
        <Box className="filter-group">
          <Typography variant="overline" color="text.secondary" className="filter-header">
            {t('DATE_RANGE')}
          </Typography>
          <DateRangeFilter
            preset={datePreset}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onPresetChange={setDatePreset}
            onCustomDateChange={handleCustomDateChange}
          />
        </Box>

        <Box className="filter-group">
          <Typography variant="overline" color="text.secondary" className="filter-header">
            {t('PAYMENT_METHOD')}
          </Typography>
          <PaymentMethodFilter
            selectedIds={paymentMethodIds}
            onChange={setPaymentMethodIds}
          />
        </Box>

        <TextField
          placeholder={t('SEARCH_CATEGORIES')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FontAwesomeIcon icon={faSearch} className="search-icon" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {/* Balance Summary */}
      <BalanceSummary
        totalIncome={statistics?.totalIncome ?? 0}
        totalExpense={statistics?.totalExpense ?? 0}
        netBalance={statistics?.netBalance ?? 0}
        currency={statistics?.currency ?? 'MKD'}
        isLoading={isLoading}
      />

      {/* Category List */}
      <Box className="categories-content">
        <Typography variant="overline" color="text.secondary" className="section-title">
          {t('CATEGORY_DETAILS')}
        </Typography>

        {isLoading ? (
          <Box className="loading-container">
            <CircularProgress />
          </Box>
        ) : statistics && statistics.categories.length > 0 ? (
          <List className="category-list">
            {statistics.categories.map((category) => (
              <ListItem
                key={category.categoryId}
                disablePadding
                className="category-list-item"
              >
                <ListItemButton className="category-button" onClick={() => {}}>
                  <CategoryStatItem
                    name={category.categoryName}
                    type={category.categoryType}
                    color={category.color}
                    recordCount={category.recordCount}
                    amount={category.totalAmount}
                    currency={statistics.currency}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Stack gap={1} className="empty-state">
            <Typography variant="h6" color="text.primary" fontWeight="bold">
              {t('NO_STATISTICS_TITLE')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('NO_STATISTICS_MESSAGE')}
            </Typography>
          </Stack>
        )}
      </Box>
    </Container>
  );
};

export default CategoriesPage;
