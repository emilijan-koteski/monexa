import './categories-page.scss';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Box, Container, Typography, TextField, InputAdornment, IconButton, List, ListItem, ListItemButton, Stack, CircularProgress } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, endOfDay } from 'date-fns';
import { DateRangePreset } from '../../enums/DateRangePreset';
import { Currency } from '../../enums/Currency';
import { useCategoryStatistics } from '../../services/categoryStatisticsService';
import { useDebounce } from '../../hooks/useDebounce';
import DateRangeFilter from '../../components/date-range-filter/DateRangeFilter';
import PaymentMethodFilter from '../../components/payment-method-filter/PaymentMethodFilter';
import CategoryPieChart from '../../components/category-pie-chart/CategoryPieChart';
import BalanceSummary from '../../components/balance-summary/BalanceSummary';
import CategoryStatItem from '../../components/category-stat-item/CategoryStatItem';

const CategoriesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [datePreset, setDatePreset] = useState<DateRangePreset>(() => {
    const preset = searchParams.get('preset');
    return preset ? (preset as DateRangePreset) : DateRangePreset.ONE_MONTH;
  });
  const [customStartDate, setCustomStartDate] = useState<Date | null>(() => {
    const startDate = searchParams.get('customStartDate');
    return startDate ? new Date(startDate) : null;
  });
  const [customEndDate, setCustomEndDate] = useState<Date | null>(() => {
    const endDate = searchParams.get('customEndDate');
    return endDate ? new Date(endDate) : null;
  });
  const [paymentMethodIds, setPaymentMethodIds] = useState<number[]>(() => {
    const ids = searchParams.getAll('paymentMethodIds');
    return ids.length > 0 ? ids.map(id => parseInt(id, 10)) : [];
  });
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('preset', datePreset);
    if (customStartDate) {
      params.set('customStartDate', customStartDate.toISOString());
    }
    if (customEndDate) {
      params.set('customEndDate', customEndDate.toISOString());
    }
    if (paymentMethodIds.length > 0) {
      paymentMethodIds.forEach(id => params.append('paymentMethodIds', id.toString()));
    }
    if (searchQuery) {
      params.set('search', searchQuery);
    }
    setSearchParams(params, { replace: true });
  }, [datePreset, customStartDate, customEndDate, paymentMethodIds, searchQuery, setSearchParams]);

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
          endDate: customEndDate ? format(endOfDay(customEndDate), "yyyy-MM-dd'T'HH:mm:ss'Z'") : undefined,
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

  const handleCategoryClick = (categoryId: number) => {
    const params = new URLSearchParams();
    params.set('preset', datePreset);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (customStartDate) params.set('customStartDate', customStartDate.toISOString());
    if (customEndDate) params.set('customEndDate', customEndDate.toISOString());
    if (paymentMethodIds.length > 0) {
      paymentMethodIds.forEach(id => params.append('paymentMethodIds', id.toString()));
    }
    if (debouncedSearch) params.set('search', debouncedSearch);

    navigate(`/categories/${categoryId}?${params.toString()}`);
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

        <Box className="filter-group">
          <Typography variant="overline" color="text.secondary" className="filter-header">
            {t('SEARCH')}
          </Typography>
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
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')} edge="end">
                      <FontAwesomeIcon icon={faXmark} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />
        </Box>
      </Box>

      {/* Category Pie Chart */}
      <CategoryPieChart
        categories={statistics?.categories ?? []}
        currency={statistics?.currency ?? Currency.MKD}
        isLoading={isLoading}
      />

      {/* Balance Summary */}
      <Box className="categories-content">
        <Typography variant="overline" color="text.secondary" className="section-title">
          {t('TOTAL_SUMMARY')}
        </Typography>
        <BalanceSummary
          totalIncome={statistics?.totalIncome ?? 0}
          totalExpense={statistics?.totalExpense ?? 0}
          netBalance={statistics?.netBalance ?? 0}
          currency={statistics?.currency ?? Currency.MKD}
          isLoading={isLoading}
        />
      </Box>

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
                <ListItemButton className="category-button" onClick={() => handleCategoryClick(category.categoryId)}>
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
