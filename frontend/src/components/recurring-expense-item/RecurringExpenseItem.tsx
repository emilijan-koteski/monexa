import './recurring-expense-item.scss';
import { Card, CardContent, Typography, IconButton, Box, Chip, Stack, Switch } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { RecurringExpense } from '../../types/models';
import { CategoryType } from '../../enums/CategoryType';
import { formatRecordAmount } from '../../utils/currency';

interface RecurringExpenseItemProps {
  recurringExpense: RecurringExpense;
  categoryName?: string;
  categoryColor?: string;
  categoryType?: CategoryType;
  paymentMethodName?: string;
  onEdit: (recurringExpense: RecurringExpense) => void;
  onDelete: (recurringExpense: RecurringExpense) => void;
  onToggleActive: (recurringExpense: RecurringExpense) => void;
  disabled?: boolean;
}

function RecurringExpenseItem({
  recurringExpense,
  categoryName,
  categoryColor = '#e63573',
  categoryType,
  paymentMethodName,
  onEdit,
  onDelete,
  onToggleActive,
  disabled = false,
}: RecurringExpenseItemProps) {
  const { t } = useTranslation();
  const displayName = recurringExpense.description || categoryName || `Category #${recurringExpense.categoryId}`;
  const isExpense = categoryType === CategoryType.EXPENSE;

  const schedule = recurringExpense.isActive
    ? `${t('NEXT_OCCURRENCE')}: ${format(new Date(recurringExpense.nextRunDate), 'MMM d, yyyy')}`
    : t('PAUSED');
  const endsLabel = recurringExpense.endDate
    ? ` · ${t('ENDS')} ${format(new Date(recurringExpense.endDate), 'MMM d, yyyy')}`
    : '';

  return (
    <Card id="recurring-expense-item" className={recurringExpense.isActive ? '' : 'inactive'}>
      <Box className="category-indicator" sx={{ backgroundColor: categoryColor }} />
      <CardContent className="recurring-content">
        <Box className="recurring-info">
          <Stack flexDirection="row" gap={1} alignItems="center" flexWrap="wrap" className="recurring-header">
            <Typography variant="h6" className="recurring-name">
              {displayName}
            </Typography>
            <Chip label={t(recurringExpense.frequency)} size="small" className="frequency-chip" />
            {paymentMethodName && (
              <Chip label={paymentMethodName} size="small" variant="outlined" className="payment-method-chip" />
            )}
          </Stack>
          <Typography variant="h5" className={`recurring-amount ${isExpense ? 'expense' : 'income'}`}>
            {formatRecordAmount(recurringExpense.amount, recurringExpense.currency, isExpense)}
          </Typography>
          <Typography variant="caption" className="recurring-schedule">
            {schedule}{endsLabel}
          </Typography>
        </Box>

        <Box className="recurring-actions">
          <Switch
            color="success"
            checked={recurringExpense.isActive}
            onChange={() => onToggleActive(recurringExpense)}
            disabled={disabled}
          />
          <IconButton color="secondary" size="large" onClick={() => onEdit(recurringExpense)} disabled={disabled}>
            <FontAwesomeIcon icon={faEdit} fontSize="medium" />
          </IconButton>
          <IconButton color="error" size="large" onClick={() => onDelete(recurringExpense)} disabled={disabled}>
            <FontAwesomeIcon icon={faTrash} fontSize="medium" />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

export default RecurringExpenseItem;
