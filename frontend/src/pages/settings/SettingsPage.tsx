import './settings-page.scss';
import { Box, Container, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSettings } from '../../services/settingService';
import { settingsGroups } from './constants/SettingsGroups.ts';
import { ENV } from '../../config/env';

const groups = ENV.LEGAL_COMPLIANCE_ENABLED
  ? settingsGroups
  : settingsGroups.filter((group) => group.categoryKey !== 'LEGAL_DOCUMENTS');

const SettingsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: settings } = useSettings();

  const handleNavigate = (path: string, external?: boolean) => {
    if (external) {
      window.open(path, '_blank');
    } else {
      navigate(path);
    }
  };

  return (
    <Container maxWidth="md" id="settings-page">
      <Box className="settings-header">
        <Typography variant="h4" color='text.primary' fontWeight='600' className="settings-title">
          {t('SETTINGS')}
        </Typography>
      </Box>

      {groups.map((group) => (
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
                  onClick={() => handleNavigate(item.path, item.external)}
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
