import './category-stat-item.scss';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CategoryType } from '../../enums/CategoryType';
import { formatRecordAmount } from '../../utils/currency';

interface CategoryStatItemProps {
  name: string;
  type: CategoryType;
  color?: string;
  recordCount: number;
  amount: number;
  currency: string;
}

function CategoryStatItem({
  name,
  type,
  color = '#e63573',
  recordCount,
  amount,
  currency,
}: CategoryStatItemProps) {
  const { t } = useTranslation();
  const isExpense = type === CategoryType.EXPENSE;

  return (
    <Box id="category-stat-item">
      <Box className="top-row">
        <Box className="color-dot" sx={{ backgroundColor: color }} />
        <Tooltip title={name} arrow>
          <Typography variant="body2" className="category-name">
            {name}
          </Typography>
        </Tooltip>
        <Chip
          label={t(type)}
          size="small"
          color={isExpense ? 'error' : 'success'}
          className="type-chip"
        />
      </Box>
      <Box className="bottom-row">
        <Typography variant="body2" color="text.secondary" className="record-count">
          {recordCount} {recordCount === 1 ? t('RECORD') : t('RECORDS')}
        </Typography>
        <Typography variant="body2" color={isExpense ? 'error' : 'success'} className="amount">
          {formatRecordAmount(amount, currency, isExpense)}
        </Typography>
      </Box>
    </Box>
  );
}

export default CategoryStatItem;
