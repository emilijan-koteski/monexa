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
import { faArrowLeft, faChevronRight, faKey } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'react-toastify';
import ChangePasswordDialog from '../../../components/change-password-dialog/ChangePasswordDialog';
import type { ChangePasswordFormData } from '../../../components/change-password-dialog/ChangePasswordDialog';
import { useChangePassword } from '../../../services/authService';

const AccountPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const changePasswordMutation = useChangePassword();

  const handleBack = () => {
    navigate('/settings');
  };

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
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
      </List>

      <ChangePasswordDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleChangePassword}
        isLoading={changePasswordMutation.isPending}
      />
    </Container>
  );
};

export default AccountPage;
