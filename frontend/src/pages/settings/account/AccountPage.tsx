import './account-page.scss';
import { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faChevronRight, faDownload, faKey, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import ChangePasswordDialog from '../../../components/change-password-dialog/ChangePasswordDialog';
import type { ChangePasswordFormData } from '../../../components/change-password-dialog/ChangePasswordDialog';
import ConfirmationDialog from '../../../components/confirmation-dialog/ConfirmationDialog';
import DownloadDataDialog from '../../../components/download-data-dialog/DownloadDataDialog';
import { useChangePassword, useDeleteAccount } from '../../../services/authService';
import { useDownloadData } from '../../../services/userService';

const AccountPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);

  const changePasswordMutation = useChangePassword();
  const deleteAccountMutation = useDeleteAccount();
  const downloadMutation = useDownloadData();

  const handleBack = () => {
    navigate('/settings');
  };

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleOpenDeleteDialog = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
  };

  const handleOpenDownloadDialog = () => {
    setIsDownloadDialogOpen(true);
  };

  const handleCloseDownloadDialog = () => {
    setIsDownloadDialogOpen(false);
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('ACCOUNT_DELETED_SUCCESS'));
        handleCloseDeleteDialog();
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : t('ACCOUNT_DELETE_ERROR'));
      },
    });
  };

  const handleChangePassword = (data: ChangePasswordFormData) => {
    changePasswordMutation.mutate(
      {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      },
      {
        onSuccess: () => {
          toast.success(t('PASSWORD_CHANGED_SUCCESS'));
          handleCloseDialog();
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t('PASSWORD_CHANGE_ERROR'));
        },
      }
    );
  };

  const handleDownloadData = (startDate: Date | null, endDate: Date | null) => {
    downloadMutation.mutate(
      {
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `monexa-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success(t('DATA_DOWNLOAD_SUCCESS'));
          handleCloseDownloadDialog();
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t('DATA_DOWNLOAD_ERROR'));
        },
      }
    );
  };

  return (
    <Container maxWidth="md" id="account-page">
      <Box className="page-header">
        <IconButton color="primary" onClick={handleBack} className="back-button">
          <FontAwesomeIcon icon={faArrowLeft} />
        </IconButton>
        <Typography variant="h5" color="text.primary" fontWeight="600" className="page-title">
          {t('ACCOUNT')}
        </Typography>
      </Box>

      <List className="settings-list">
        <ListItem disablePadding className="settings-list-item">
          <ListItemButton onClick={handleOpenDialog} className="settings-button">
            <ListItemIcon className="settings-icon">
              <FontAwesomeIcon icon={faKey} />
            </ListItemIcon>
            <ListItemText
              primary={t('CHANGE_PASSWORD')}
              secondary={t('CHANGE_PASSWORD_DESCRIPTION')}
              className="settings-text"
            />
            <FontAwesomeIcon icon={faChevronRight} className="chevron-icon" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding className="settings-list-item">
          <ListItemButton onClick={handleOpenDownloadDialog} className="settings-button">
            <ListItemIcon className="settings-icon">
              <FontAwesomeIcon icon={faDownload} />
            </ListItemIcon>
            <ListItemText
              primary={t('DOWNLOAD_DATA')}
              secondary={t('DOWNLOAD_DATA_DESCRIPTION')}
              className="settings-text"
            />
            <FontAwesomeIcon icon={faChevronRight} className="chevron-icon" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding className="settings-list-item">
          <ListItemButton onClick={handleOpenDeleteDialog} className="settings-button danger">
            <ListItemIcon className="settings-icon danger">
              <FontAwesomeIcon icon={faTrash} />
            </ListItemIcon>
            <ListItemText
              primary={t('DELETE_ACCOUNT')}
              secondary={t('DELETE_ACCOUNT_DESCRIPTION')}
              className="settings-text danger"
            />
            <FontAwesomeIcon icon={faChevronRight} className="chevron-icon" />
          </ListItemButton>
        </ListItem>
      </List>

      <ChangePasswordDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleChangePassword}
        isLoading={changePasswordMutation.isPending}
      />

      <DownloadDataDialog
        open={isDownloadDialogOpen}
        onClose={handleCloseDownloadDialog}
        onDownload={handleDownloadData}
        isLoading={downloadMutation.isPending}
      />

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleDeleteAccount}
        title="DELETE_ACCOUNT_TITLE"
        message="DELETE_ACCOUNT_MESSAGE"
        confirmText="DELETE"
        confirmColor="error"
        isLoading={deleteAccountMutation.isPending}
      />
    </Container>
  );
};

export default AccountPage;
