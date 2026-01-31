import './record-item.scss';
import { Card, CardContent, Typography, IconButton, Box, Chip, Stack } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { FinancialRecord } from '../../types/models';
import { CategoryType } from '../../enums/CategoryType';
import { formatRecordAmount } from '../../utils/currency';

interface RecordItemProps {
  record: FinancialRecord;
  categoryName?: string;
  categoryColor?: string;
  categoryType?: CategoryType;
  paymentMethodName?: string;
  onEdit: (record: FinancialRecord) => void;
  onDelete: (record: FinancialRecord) => void;
}

function RecordItem({
  record,
  categoryName,
  categoryColor = '#e63573',
  categoryType,
  paymentMethodName,
  onEdit,
  onDelete,
}: RecordItemProps) {
  const displayName = record.description || categoryName || `Category #${record.categoryId}`;
  const isExpense = categoryType === CategoryType.EXPENSE;

  return (
    <Card id="record-item">
      <Box
        className="category-indicator"
        sx={{ backgroundColor: categoryColor }}
      />
      <CardContent className="record-content">
        <Box className="record-info">
          <Stack flexDirection='row' gap={1} alignItems='center' className="record-header">
            <Typography variant="h6" className="record-name">
              {displayName}
            </Typography>
            {paymentMethodName && (
              <Chip
                label={paymentMethodName}
                size="small"
                variant="outlined"
                className="payment-method-chip"
              />
            )}
          </Stack>
          <Typography
            variant="h5"
            className={`record-amount ${isExpense ? 'expense' : 'income'}`}
          >
            {formatRecordAmount(record.amount, record.currency, isExpense)}
          </Typography>
        </Box>

        <Box className="record-actions">
          <IconButton
            color="secondary"
            size="large"
            onClick={() => onEdit(record)}
          >
            <FontAwesomeIcon icon={faEdit} fontSize="medium" />
          </IconButton>
          <IconButton
            color="error"
            size="large"
            onClick={() => onDelete(record)}
          >
            <FontAwesomeIcon icon={faTrash} fontSize="medium" />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

export default RecordItem;
