import './record-item.scss';
import { Card, CardContent, Typography, IconButton, Box } from '@mui/material';
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
  onEdit: (record: FinancialRecord) => void;
  onDelete: (record: FinancialRecord) => void;
}

function RecordItem({
  record,
  categoryName,
  categoryColor = '#e63573',
  categoryType,
  onEdit,
  onDelete,
}: RecordItemProps) {
  const displayName = record.description || categoryName || `Category #${record.categoryId}`;
  const isExpense = categoryType === CategoryType.EXPENSE;

  return (
    <Card id="record-item">
      <Box className="category-indicator" style={{ backgroundColor: categoryColor }} />
      <CardContent className="record-content">
        <Box className="record-info">
          <Typography variant="h6" className="record-name">
            {displayName}
          </Typography>
          <Typography
            variant="h5"
            className={`record-amount ${isExpense ? 'expense' : 'income'}`}
          >
            {formatRecordAmount(record.amount, record.currency, isExpense)}
          </Typography>
        </Box>

        <Box className="record-actions">
          <IconButton
            size="small"
            color="secondary"
            onClick={() => onEdit(record)}
            className="edit-button"
          >
            <FontAwesomeIcon icon={faEdit} />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(record)}
            className="delete-button"
          >
            <FontAwesomeIcon icon={faTrash} />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

export default RecordItem;
