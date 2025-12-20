import './settings-page.scss';
import { Box, Container, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSettings } from '../../services/settingService';
import { settingsGroups } from './constants/SettingsGroups.ts';

const SettingsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: settings } = useSettings();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <Container maxWidth="md" id="settings-page">
      <Box className="settings-header">
        <Typography variant="h4" color='text.primary' fontWeight='600' className="settings-title">
          {t('SETTINGS')}
        </Typography>
      </Box>

      {settingsGroups.map((group) => (
        <Box key={group.categoryKey} className="settings-group">
          <Typography variant="overline" color='text.secondary' className="group-header">
            {t(group.categoryKey)}
          </Typography>

          <List className="settings-list">
            {group.items.map((item) => (
              <ListItem
                key={item.path}
                disablePadding
                className="settings-list-item"
              >
                <ListItemButton
                  onClick={() => handleNavigate(item.path)}
                  className="settings-button"
                >
                  <ListItemIcon className="settings-icon">
                    <FontAwesomeIcon icon={item.icon} />
                  </ListItemIcon>
                  <ListItemText
                    primary={t(item.titleKey)}
                    className="settings-text"
                  />
                  {item.showValue && item.getValue && (
                    <Typography variant="body2" className="settings-value">
                      {item.getValue(settings)}
                    </Typography>
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      ))}
    </Container>
  );
};

export default SettingsPage;
