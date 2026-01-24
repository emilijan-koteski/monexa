import './balance-summary.scss';
import { Box, Card, CardContent, Typography, Stack, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatCurrencyAmount } from '../../utils/currency';

interface BalanceSummaryProps {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  currency: string;
  isLoading?: boolean;
}

function BalanceSummary({
  totalIncome,
  totalExpense,
  netBalance,
  currency,
  isLoading,
}: BalanceSummaryProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card id="balance-summary">
        <CardContent>
          <Stack direction="row" gap={2} className="summary-items">
            <Box className="summary-item">
              <Skeleton variant="text" width={80} height={20} />
              <Skeleton variant="text" width={100} height={28} />
            </Box>
            <Box className="summary-item">
              <Skeleton variant="text" width={80} height={20} />
              <Skeleton variant="text" width={100} height={28} />
            </Box>
            <Box className="summary-item">
              <Skeleton variant="text" width={80} height={20} />
              <Skeleton variant="text" width={100} height={28} />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const isPositiveBalance = netBalance >= 0;

  return (
    <Card id="balance-summary">
      <CardContent>
        <Stack direction="row" gap={2} className="summary-items">
          <Box className="summary-item">
            <Typography variant="body2" color='textSecondary' className="summary-label">
              {t('TOTAL_INCOME')}
            </Typography>
            <Typography variant="h6" color='success' fontWeight='bold' className="summary-value">
              +{formatCurrencyAmount(totalIncome, currency)}
            </Typography>
          </Box>

          <Box className="summary-item">
            <Typography variant="body2" color='textSecondary' className="summary-label">
              {t('TOTAL_EXPENSE')}
            </Typography>
            <Typography variant="h6" color='error' fontWeight='bold' className="summary-value">
              -{formatCurrencyAmount(totalExpense, currency)}
            </Typography>
          </Box>

          <Box className='summary-item'>
            <Typography variant="body2" color='textSecondary'className="summary-label">
              {t('NET_BALANCE')}
            </Typography>
            <Typography variant="h6" color={isPositiveBalance ? 'success' : 'error'} fontWeight='bold' className="summary-value">
              {isPositiveBalance ? '+' : ''}{formatCurrencyAmount(netBalance, currency)}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default BalanceSummary;
