import './home-page.scss';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import {
  Box,
  Fab,
  Typography,
  CircularProgress,
  Container,
  Stack,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay } from 'date-fns';
import DateSelector from '../../components/date-selector/DateSelector';
import SummaryCard from '../../components/summary-card/SummaryCard';
import RecordItem from '../../components/record-item/RecordItem';
import RecordDialog, {
  type RecordFormData,
} from '../../components/record-dialog/RecordDialog';
import ConfirmationDialog from '../../components/confirmation-dialog/ConfirmationDialog';
import {
  useRecords,
  useRecordSummary,
  useCreateRecord,
  useUpdateRecord,
  useDeleteRecord,
} from '../../services/recordService';
import { useCategories } from '../../services/categoryService';
import type { FinancialRecord } from '../../types/models';

function HomePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? new Date(dateParam) : new Date();
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FinancialRecord | null>(
    null
  );
  const [recordToDelete, setRecordToDelete] = useState<FinancialRecord | null>(
    null
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', selectedDate.toISOString());
    setSearchParams(params, { replace: true });
  }, [selectedDate, setSearchParams]);

  const startDate = format(
    startOfDay(selectedDate),
    "yyyy-MM-dd'T'HH:mm:ss'Z'"
  );
  const endDate = format(endOfDay(selectedDate), "yyyy-MM-dd'T'HH:mm:ss'Z'");

  const { data: records, isLoading: recordsLoading } = useRecords(
    startDate,
    endDate
  );
  const { data: categories } = useCategories();
  const { data: summary, isLoading: summaryLoading } = useRecordSummary(
    startDate,
    endDate
  );
  const createRecordMutation = useCreateRecord();
  const updateRecordMutation = useUpdateRecord();
  const deleteRecordMutation = useDeleteRecord();

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleNewRecord = () => {
    setSelectedRecord(null);
    setDialogOpen(true);
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
    try {
      const payload = {
        categoryId: data.categoryId,
        paymentMethodId: data.paymentMethodId,
        amount: data.amount,
        currency: data.currency,
        description: data.description || undefined,
        date: format(data.date, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      };

      if (selectedRecord) {
        await updateRecordMutation.mutateAsync({
          id: selectedRecord.id,
          data: payload,
        });
        toast.success(t('RECORD_UPDATED_SUCCESS'));
      } else {
        await createRecordMutation.mutateAsync(payload);
        toast.success(t('RECORD_CREATED_SUCCESS'));
      }

      handleDialogClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t('RECORD_SAVE_ERROR');
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
      const errorMessage =
        error instanceof Error ? error.message : t('RECORD_DELETE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const getCategoryDetails = (categoryId: number) => {
    const category = categories?.find((c) => c.id === categoryId);
    return {
      name: category?.name,
      color: category?.color,
      type: category?.type,
    };
  };

  const isAnyMutationLoading =
    createRecordMutation.isPending ||
    updateRecordMutation.isPending ||
    deleteRecordMutation.isPending;

  return (
    <>
      <Container maxWidth='md' id='home-page'>
        <DateSelector
          selectedDate={selectedDate}
          onChange={handleDateChange}
        />

        {summary && summary.amount !== 0 && (
          <SummaryCard summary={summary} isLoading={summaryLoading} />
        )}

        <Box className='records-section'>
          {recordsLoading ? (
            <Box className='loading-container'>
              <CircularProgress />
            </Box>
          ) : records && records.length > 0 ? (
            <Stack gap={1.5}>
              {records.map((record) => {
                const categoryDetails = getCategoryDetails(record.categoryId);
                return (
                  <RecordItem
                    key={record.id}
                    record={record}
                    categoryName={categoryDetails.name}
                    categoryColor={categoryDetails.color}
                    categoryType={categoryDetails.type}
                    onEdit={handleEditRecord}
                    onDelete={handleDeleteClick}
                  />
                );
              })}
            </Stack>
          ) : (
            <Stack gap={1} className='empty-state'>
              <Typography variant='h6' color='text.primary' fontWeight='bold'>
                {t('NO_RECORDS_TITLE')}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {t('NO_RECORDS_MESSAGE')}
              </Typography>
            </Stack>
          )}
        </Box>

        <Fab
          color='primary'
          className='add-record-fab'
          onClick={handleNewRecord}
        >
          <FontAwesomeIcon icon={faPlus} />
        </Fab>
      </Container>

      <RecordDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
        record={selectedRecord}
        isLoading={isAnyMutationLoading}
        defaultDate={selectedDate}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteRecordMutation.isPending}
        title='DELETE_CONFIRMATION_TITLE'
        message='DELETE_CONFIRMATION_MESSAGE'
        confirmText='DELETE'
        confirmColor='error'
      />
    </>
  );
}

export default HomePage;
