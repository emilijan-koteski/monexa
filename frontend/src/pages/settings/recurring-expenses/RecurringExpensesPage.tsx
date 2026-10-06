import './recurring-expenses-page.scss';
import { useState } from 'react';
import { Box, Button, CircularProgress, Container, IconButton, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  useRecurringExpenses,
  useCreateRecurringExpense,
  useUpdateRecurringExpense,
  useDeleteRecurringExpense,
} from '../../../services/recurringExpenseService';
import { useCategories } from '../../../services/categoryService';
import { usePaymentMethods } from '../../../services/paymentMethodService';
import type { RecurringExpense } from '../../../types/models';
import type { RecurringExpenseRequest } from '../../../types/requests';
import RecurringExpenseItem from '../../../components/recurring-expense-item/RecurringExpenseItem';
import RecurringExpenseDialog, { type RecurringExpenseFormData } from '../../../components/recurring-expense-dialog/RecurringExpenseDialog';
import ConfirmationDialog from '../../../components/confirmation-dialog/ConfirmationDialog';

const toApiDate = (date: Date): string => format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'");

const RecurringExpensesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: recurringExpenses, isLoading } = useRecurringExpenses();
  const { data: categories } = useCategories();
  const { data: paymentMethods } = usePaymentMethods();
  const createMutation = useCreateRecurringExpense();
  const updateMutation = useUpdateRecurringExpense();
  const deleteMutation = useDeleteRecurringExpense();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecurringExpense, setSelectedRecurringExpense] = useState<RecurringExpense | null>(null);
  const [recurringExpenseToDelete, setRecurringExpenseToDelete] = useState<RecurringExpense | null>(null);

  const handleBack = () => {
    navigate('/settings');
  };

  const handleNew = () => {
    setSelectedRecurringExpense(null);
    setDialogOpen(true);
  };

  const handleEdit = (recurringExpense: RecurringExpense) => {
    setSelectedRecurringExpense(recurringExpense);
    setDialogOpen(true);
  };

  const handleDeleteClick = (recurringExpense: RecurringExpense) => {
    setRecurringExpenseToDelete(recurringExpense);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedRecurringExpense(null);
  };

  const handleDialogSubmit = async (data: RecurringExpenseFormData) => {
    try {
      const payload: RecurringExpenseRequest = {
        categoryId: data.categoryId,
        paymentMethodId: data.paymentMethodId,
        amount: data.amount,
        currency: data.currency,
        description: data.description ?? undefined,
        frequency: data.frequency,
        startDate: toApiDate(data.startDate),
        endDate: data.endDate ? toApiDate(data.endDate) : undefined,
      };

      if (selectedRecurringExpense) {
        const update: Partial<RecurringExpenseRequest> = { ...payload };
        if (!data.endDate && selectedRecurringExpense.endDate) {
          update.clearEndDate = true;
        }
        await updateMutation.mutateAsync({ id: selectedRecurringExpense.id, data: update });
        toast.success(t('RECURRING_EXPENSE_UPDATED_SUCCESS'));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t('RECURRING_EXPENSE_CREATED_SUCCESS'));
      }

      handleDialogClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('RECURRING_EXPENSE_SAVE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleToggleActive = async (recurringExpense: RecurringExpense) => {
    try {
      await updateMutation.mutateAsync({
        id: recurringExpense.id,
        data: { isActive: !recurringExpense.isActive },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('RECURRING_EXPENSE_SAVE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!recurringExpenseToDelete) return;

    try {
      await deleteMutation.mutateAsync(recurringExpenseToDelete.id);
      toast.success(t('RECURRING_EXPENSE_DELETED_SUCCESS'));
      setDeleteDialogOpen(false);
      setRecurringExpenseToDelete(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('RECURRING_EXPENSE_DELETE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRecurringExpenseToDelete(null);
  };

  const getCategoryDetails = (categoryId: number) => {
    const category = categories?.find((c) => c.id === categoryId);
    return {
      name: category?.name,
      color: category?.color,
      type: category?.type,
    };
  };

  const getPaymentMethodName = (paymentMethodId: number) => {
    return paymentMethods?.find((pm) => pm.id === paymentMethodId)?.name;
  };

  const isAnyMutationLoading =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <Container maxWidth="md" id="recurring-expenses-page">
        <Box className="page-header">
          <IconButton color="primary" onClick={handleBack} className="back-button">
            <FontAwesomeIcon icon={faArrowLeft} />
          </IconButton>
          <Typography variant="h5" color="text.primary" fontWeight="600" className="page-title">
            {t('RECURRING_EXPENSES')}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNew}
            className="add-button"
            startIcon={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('NEW')}
          </Button>
        </Box>

        {isLoading ? (
          <Box className="loading-container">
            <CircularProgress />
          </Box>
        ) : recurringExpenses && recurringExpenses.length > 0 ? (
          <Stack gap={1.5} className="recurring-list">
            {recurringExpenses.map((recurringExpense) => {
              const categoryDetails = getCategoryDetails(recurringExpense.categoryId);
              return (
                <RecurringExpenseItem
                  key={recurringExpense.id}
                  recurringExpense={recurringExpense}
                  categoryName={categoryDetails.name}
                  categoryColor={categoryDetails.color}
                  categoryType={categoryDetails.type}
                  paymentMethodName={getPaymentMethodName(recurringExpense.paymentMethodId)}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onToggleActive={handleToggleActive}
                  disabled={isAnyMutationLoading}
                />
              );
            })}
          </Stack>
        ) : (
          <Stack gap={1} className="empty-state">
            <Typography variant="h6" color="text.primary" fontWeight="bold">
              {t('NO_RECURRING_EXPENSES_TITLE')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('NO_RECURRING_EXPENSES_MESSAGE')}
            </Typography>
          </Stack>
        )}
      </Container>

      <RecurringExpenseDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
        recurringExpense={selectedRecurringExpense}
        isLoading={isAnyMutationLoading}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
        title="DELETE_RECURRING_EXPENSE_TITLE"
        message="DELETE_RECURRING_EXPENSE_MESSAGE"
        confirmText="DELETE"
        confirmColor="error"
      />
    </>
  );
};

export default RecurringExpensesPage;
