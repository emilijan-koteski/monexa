import './language-page.scss';
import {
  Container,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSettings, useUpdateSettings } from '../../../services/settingService';
import { Language } from '../../../enums/Language';
import { toast } from 'react-toastify';
import { languages } from '../constants/Languages.ts';
import { changeLanguage } from '../../../i18n.ts';

const LanguagePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const handleBack = () => {
    navigate('/settings');
  };

  const handleLanguageChange = async (language: Language) => {
    if (settings?.language === language) {
      return;
    }

    try {
      await updateMutation.mutateAsync({ language });
      changeLanguage(language);
      toast.success(t('LANGUAGE_UPDATED_SUCCESS'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('LANGUAGE_UPDATE_ERROR');
      toast.error(errorMessage);
    }
  };

  return (
    <Container maxWidth="md" id="language-page">
      <Box className="page-header">
        <IconButton color='primary' onClick={handleBack} className="back-button">
          <FontAwesomeIcon icon={faArrowLeft} />
        </IconButton>
        <Typography variant="h5" color='text.primary' fontWeight='600' className="page-title">
          {t('LANGUAGE')}
        </Typography>
      </Box>

      {isLoading ? (
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      ) : (
        <List className="language-list">
          {languages.map((lang) => {
            const isSelected = settings?.language === lang.value;
            return (
              <ListItem
                key={lang.value}
                disablePadding
                className="language-list-item"
              >
                <ListItemButton
                  onClick={() => handleLanguageChange(lang.value)}
                  disabled={updateMutation.isPending}
                  className={`language-button ${isSelected ? 'selected' : ''}`}
                >
                  <ListItemText
                    primary={`${lang.value} (${t(lang.labelKey)})`}
                    className="language-text"
                  />
                  {isSelected && (
                    <FontAwesomeIcon icon={faCheck} className="check-icon" />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Container>
  );
};

export default LanguagePage;
