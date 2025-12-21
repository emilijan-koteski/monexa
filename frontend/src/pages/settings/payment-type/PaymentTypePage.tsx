import './payment-type-page.scss';
import { useState } from 'react';
import { Box, Button, CircularProgress, Container, IconButton, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useCreatePaymentMethod, useDeletePaymentMethod, usePaymentMethods, useUpdatePaymentMethod } from '../../../services/paymentMethodService';
import type { PaymentMethod } from '../../../types/models';
import { toast } from 'react-toastify';
import PaymentTypeDialog, { type PaymentTypeFormData } from '../../../components/payment-type-dialog/PaymentTypeDialog.tsx';
import ConfirmationDialog from '../../../components/confirmation-dialog/ConfirmationDialog';

const PaymentTypePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: paymentMethods, isLoading } = usePaymentMethods();
  const createMutation = useCreatePaymentMethod();
  const updateMutation = useUpdatePaymentMethod();
  const deleteMutation = useDeletePaymentMethod();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<PaymentMethod | null>(null);

  const handleBack = () => {
    navigate('/settings');
  };

  const handleNewPaymentMethod = () => {
    setSelectedPaymentMethod(null);
    setDialogOpen(true);
  };

  const handleEditPaymentMethod = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod);
    setDialogOpen(true);
  };

  const handleDeleteClick = (paymentMethod: PaymentMethod) => {
    setPaymentMethodToDelete(paymentMethod);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedPaymentMethod(null);
  };

  const handleDialogSubmit = async (data: PaymentTypeFormData) => {
    try {
      if (selectedPaymentMethod) {
        await updateMutation.mutateAsync({
          id: selectedPaymentMethod.id,
          data: { name: data.name },
        });
        toast.success(t('PAYMENT_TYPE_UPDATED_SUCCESS'));
      } else {
        await createMutation.mutateAsync({ name: data.name });
        toast.success(t('PAYMENT_TYPE_CREATED_SUCCESS'));
      }

      handleDialogClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('PAYMENT_TYPE_SAVE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!paymentMethodToDelete) return;

    try {
      await deleteMutation.mutateAsync(paymentMethodToDelete.id);
      toast.success(t('PAYMENT_TYPE_DELETED_SUCCESS'));
      setDeleteDialogOpen(false);
      setPaymentMethodToDelete(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('PAYMENT_TYPE_DELETE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPaymentMethodToDelete(null);
  };

  const isAnyMutationLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <>
      <Container maxWidth="md" id="payment-type-page">
        <Box className="page-header">
          <IconButton
            color="primary"
            onClick={handleBack}
            className="back-button"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </IconButton>
          <Typography
            variant="h5"
            color="text.primary"
            fontWeight="600"
            className="page-title"
          >
            {t('PAYMENT_TYPE')}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNewPaymentMethod}
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
        ) : paymentMethods && paymentMethods.length > 0 ? (
          <List className="payment-type-list">
            {paymentMethods.map((paymentMethod) => (
              <ListItem
                key={paymentMethod.id}
                disablePadding
                className="payment-type-list-item"
              >
                <Box className="payment-type-item">
                  <ListItemText
                    primary={paymentMethod.name}
                    className="payment-type-text"
                  />
                  <Box className="action-buttons">
                    <IconButton
                      color="primary"
                      size="small"
                      onClick={() => handleEditPaymentMethod(paymentMethod)}
                      disabled={isAnyMutationLoading}
                      className="edit-button"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </IconButton>
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => handleDeleteClick(paymentMethod)}
                      disabled={isAnyMutationLoading}
                      className="delete-button"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </IconButton>
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        ) : (
          <Stack gap={1} className="empty-state">
            <Typography variant="h6" color="text.primary" fontWeight="bold">
              {t('NO_PAYMENT_TYPES_TITLE')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('NO_PAYMENT_TYPES_MESSAGE')}
            </Typography>
          </Stack>
        )}
      </Container>

      <PaymentTypeDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
        paymentMethod={selectedPaymentMethod}
        isLoading={isAnyMutationLoading}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
        title="DELETE_PAYMENT_TYPE_TITLE"
        message="DELETE_PAYMENT_TYPE_MESSAGE"
        confirmText="DELETE"
        confirmColor="error"
      />
    </>
  );
};

export default PaymentTypePage;
