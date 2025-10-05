import { useState } from 'react';
import {
  Avatar,
  Box,
  Divider,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCog, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { getStoredUser, useLogout } from '../../services/authService';
import './UserAvatar.scss';

const UserAvatar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const user = getStoredUser();
  const logoutMutation = useLogout();

  const isProfileActive = location.pathname === '/profile';
  const isSettingsActive = location.pathname === '/settings';

  const profileClasses = ['menu-item', isProfileActive && 'active'].filter(Boolean).join(' ');
  const settingsClasses = ['menu-item', isSettingsActive && 'active'].filter(Boolean).join(' ');

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    navigate('/profile');
    handleClose();
  };

  const handleSettings = () => {
    navigate('/settings');
    handleClose();
  };

  const handleLogout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      logoutMutation.mutate(refreshToken, {
        onSuccess: () => {
          navigate('/');
        },
      });
    }
    handleClose();
  };

  if (!user) return null;

  const userInitial = user.name.charAt(0).toUpperCase();

  return (
    <div id="user-avatar">
      <Box onClick={handleClick} className="avatar-container">
        <Avatar className="avatar">
          {userInitial}
        </Avatar>
        {!isMobile && (
          <Typography variant="body2" className="user-name">
            {user.name}
          </Typography>
        )}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        className="avatar-menu"
      >
        <MenuItem onClick={handleProfile} className={profileClasses}>
          <Box className="menu-item-content">
            <FontAwesomeIcon icon={faUser} size="sm" className="menu-icon" />
            <Typography variant="body2" className="menu-text">
              {t('PROFILE')}
            </Typography>
          </Box>
        </MenuItem>

        <MenuItem onClick={handleSettings} className={settingsClasses}>
          <Box className="menu-item-content">
            <FontAwesomeIcon icon={faCog} size="sm" className="menu-icon" />
            <Typography variant="body2" className="menu-text">
              {t('SETTINGS')}
            </Typography>
          </Box>
        </MenuItem>

        <Divider className="menu-divider" />

        <MenuItem onClick={handleLogout} className="menu-item">
          <Box className="menu-item-content">
            <FontAwesomeIcon icon={faSignOutAlt} size="sm" className="menu-icon" />
            <Typography variant="body2" className="menu-text">
              {t('LOGOUT')}
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </div>
  );
};

export default UserAvatar;
