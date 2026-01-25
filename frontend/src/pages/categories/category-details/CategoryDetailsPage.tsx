import './category-details-page.scss';
import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import {
  Container,
  Box,
  Typography,
  IconButton,
  Stack,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowUp, faArrowDown, faCalendar, faDollarSign } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import { useFilteredRecords, useUpdateRecord, useDeleteRecord } from '../../../services/recordService';
import { useCategory } from '../../../services/categoryService';
import RecordItem from '../../../components/record-item/RecordItem';
import RecordDialog, { type RecordFormData } from '../../../components/record-dialog/RecordDialog';
import ConfirmationDialog from '../../../components/confirmation-dialog/ConfirmationDialog';
import type { FinancialRecord, RecordGroup } from '../../../types/models';
import type { RecordFilter } from '../../../types/requests';

type SortBy = 'date' | 'amount';
type SortOrder = 'asc' | 'desc';

const CategoryDetailsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const [searchParams] = useSearchParams();

  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FinancialRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<FinancialRecord | null>(null);

  const filters: RecordFilter = useMemo(() => {
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const paymentMethodIdsStr = searchParams.getAll('paymentMethodIds');
    const paymentMethodIds = paymentMethodIdsStr.length > 0
      ? paymentMethodIdsStr.map(id => parseInt(id, 10))
      : undefined;
    const search = searchParams.get('search') || undefined;

    return {
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      startDate,
      endDate,
      paymentMethodIds,
      search,
      sortBy,
      sortOrder,
    };
  }, [categoryId, searchParams, sortBy, sortOrder]);

  const { data: records, isLoading: recordsLoading } = useFilteredRecords(filters);
  const { data: category, isLoading: categoryLoading } = useCategory(
    categoryId ? parseInt(categoryId, 10) : 0
  );

  const updateRecordMutation = useUpdateRecord();
  const deleteRecordMutation = useDeleteRecord();

  const groupedRecords = useMemo((): RecordGroup[] => {
    if (!records || sortBy !== 'date') return [];

    const groups = new Map<string, FinancialRecord[]>();

    records.forEach(record => {
      const dateKey = format(parseISO(record.date), 'yyyy-MM-dd');
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(record);
    });

    return Array.from(groups.entries()).map(([date, recs]) => ({
      date,
      formattedDate: format(parseISO(date), 'EEEE, MMMM d, yyyy'),
      records: recs,
    }));
  }, [records, sortBy]);

  const handleBack = () => {
    navigate(`/categories?${searchParams.toString()}`);
  };

  const handleSortByChange = (_: React.MouseEvent<HTMLElement>, newSortBy: SortBy | null) => {
    if (newSortBy) {
      setSortBy(newSortBy);
    }
  };

  const handleSortOrderToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleEditRecord = (record: FinancialRecord) => {
    setSelectedRecord(record);
    setDialogOpen(true);
  };

  const handleDeleteClick = (record: FinancialRecord) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedRecord(null);
  };

  const handleDialogSubmit = async (data: RecordFormData) => {
    if (!selectedRecord) return;

    try {
      const payload = {
        categoryId: data.categoryId,
        paymentMethodId: data.paymentMethodId,
        amount: data.amount,
        currency: data.currency,
        description: data.description || undefined,
        date: format(data.date, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      };

      await updateRecordMutation.mutateAsync({
        id: selectedRecord.id,
        data: payload,
      });
      toast.success(t('RECORD_UPDATED_SUCCESS'));
      handleDialogClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('RECORD_SAVE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;

    try {
      await deleteRecordMutation.mutateAsync(recordToDelete.id);
      toast.success(t('RECORD_DELETED_SUCCESS'));
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('RECORD_DELETE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const isLoading = recordsLoading || categoryLoading;
  const isAnyMutationLoading = updateRecordMutation.isPending || deleteRecordMutation.isPending;

  return (
    <>
      <Container maxWidth="md" id="category-details-page">
        {/* Header */}
        <Box className="page-header">
          <IconButton color="primary" onClick={handleBack} className="back-button">
            <FontAwesomeIcon icon={faArrowLeft} />
          </IconButton>
          <Typography variant="h5" color="text.primary" fontWeight="600" className="page-title">
            {category?.name || t('CATEGORY_DETAILS')}
          </Typography>
        </Box>

        {/* Sort Controls */}
        <Box className="sort-controls">
          <ToggleButtonGroup
            value={sortBy}
            exclusive
            onChange={handleSortByChange}
            size="small"
            className="sort-by-group"
          >
            <ToggleButton value="date">
              <FontAwesomeIcon icon={faCalendar} />
              <span className="toggle-label">{t('DATE')}</span>
            </ToggleButton>
            <ToggleButton value="amount">
              <FontAwesomeIcon icon={faDollarSign} />
              <span className="toggle-label">{t('AMOUNT')}</span>
            </ToggleButton>
          </ToggleButtonGroup>

          <IconButton
            onClick={handleSortOrderToggle}
            className="sort-order-button"
            color="primary"
          >
            <FontAwesomeIcon icon={sortOrder === 'asc' ? faArrowUp : faArrowDown} />
          </IconButton>
        </Box>

        {/* Records Content */}
        <Box className="records-content">
          {isLoading ? (
            <Box className="loading-container">
              <CircularProgress />
            </Box>
          ) : records && records.length > 0 ? (
            sortBy === 'date' ? (
              <Stack gap={2}>
                {groupedRecords.map(group => (
                  <Box key={group.date} className="date-group">
                    <Typography variant="overline" className="date-header">
                      {group.formattedDate}
                    </Typography>
                    <Stack gap={1.5}>
                      {group.records.map(record => (
                        <RecordItem
                          key={record.id}
                          record={record}
                          categoryName={category?.name}
                          categoryColor={category?.color}
                          categoryType={category?.type}
                          onEdit={handleEditRecord}
                          onDelete={handleDeleteClick}
                        />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Stack gap={1.5}>
                {records.map(record => (
                  <RecordItem
                    key={record.id}
                    record={record}
                    categoryName={category?.name}
                    categoryColor={category?.color}
                    categoryType={category?.type}
                    onEdit={handleEditRecord}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </Stack>
            )
          ) : (
            <Stack gap={1} className="empty-state">
              <Typography variant="h6" color="text.primary" fontWeight="bold">
                {t('NO_RECORDS_TITLE')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('NO_RECORDS_FOR_CATEGORY')}
              </Typography>
            </Stack>
          )}
        </Box>
      </Container>

      <RecordDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
        record={selectedRecord}
        isLoading={isAnyMutationLoading}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteRecordMutation.isPending}
        title="DELETE_CONFIRMATION_TITLE"
        message="DELETE_CONFIRMATION_MESSAGE"
        confirmText="DELETE"
        confirmColor="error"
      />
    </>
  );
};

export default CategoryDetailsPage;
