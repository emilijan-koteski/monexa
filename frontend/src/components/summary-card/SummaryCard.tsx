import './summary-card.scss';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatCurrencyAmount } from '../../utils/currency';
import type { RecordSummary } from '../../types/models';

interface SummaryCardProps {
  summary: RecordSummary;
  isLoading?: boolean;
}

function SummaryCard({ summary, isLoading }: SummaryCardProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card id="summary-card">
        <CardContent>
          <Box className="summary-content">
            <Typography variant="body2" className="summary-label">
              {t('TOTAL_SUMMARY')}
            </Typography>
            <Typography variant="h5" className="summary-amount">
              ...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const isPositive = summary.amount >= 0;
  const formattedAmount = formatCurrencyAmount(
    Math.abs(summary.amount),
    summary.currency
  );
  const sign = isPositive ? '+' : '-';
  const amountClass = isPositive ? 'income' : 'expense';

  return (
    <Card id="summary-card">
      <CardContent>
        <Box className="summary-content">
          <Typography variant="body2" className="summary-label">
            {t('TOTAL_SUMMARY')}
          </Typography>
          <Typography variant="h5" className={`summary-amount ${amountClass}`}>
            {sign}{formattedAmount}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default SummaryCard;
