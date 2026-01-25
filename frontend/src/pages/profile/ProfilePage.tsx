import './profile-page.scss';
import { useState } from 'react';
import {
  Avatar,
  Box,
  Container,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPen, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { tokenUtils } from '../../utils/tokenUtils';
import { useUpdateUser } from '../../services/userService';

const ProfilePage = () => {
  const { t } = useTranslation();
  const user = tokenUtils.getUser();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');

  const updateUserMutation = useUpdateUser();

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const handleEditClick = () => {
    setEditedName(user?.name || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedName(user?.name || '');
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!editedName.trim()) {
      toast.error(t('NAME_REQUIRED'));
      return;
    }

    updateUserMutation.mutate(
      { name: editedName.trim() },
      {
        onSuccess: () => {
          toast.success(t('PROFILE_UPDATED_SUCCESS'));
          setIsEditing(false);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t('PROFILE_UPDATE_ERROR'));
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Container maxWidth="md" id="profile-page">
      <Box className="page-header">
        <Typography variant="h4" color="text.primary" fontWeight="600" className="page-title">
          {t('PROFILE')}
        </Typography>
      </Box>

      <Box className="profile-card">
        <Avatar className="profile-avatar">
          {getInitial(user.name)}
        </Avatar>

        <Box className="profile-info">
          {isEditing ? (
            <Box className="edit-name-form">
              <TextField
                size="small"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="name-input"
                placeholder={t('NAME')}
              />
              <Box className="form-actions">
                <IconButton
                  onClick={handleSave}
                  disabled={updateUserMutation.isPending || !editedName.trim()}
                  className="save-button"
                  size="small"
                >
                  <FontAwesomeIcon icon={faCheck} />
                </IconButton>
                <IconButton
                  onClick={handleCancelEdit}
                  disabled={updateUserMutation.isPending}
                  className="cancel-button"
                  size="small"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </IconButton>
              </Box>
            </Box>
          ) : (
            <Box className="name-section">
              <Typography variant="h5" className="profile-name">
                {user.name}
              </Typography>
              <IconButton onClick={handleEditClick} className="edit-button" size="small">
                <FontAwesomeIcon icon={faPen} />
              </IconButton>
            </Box>
          )}

          <Typography variant="body1" className="profile-email">
            {user.email}
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default ProfilePage;
