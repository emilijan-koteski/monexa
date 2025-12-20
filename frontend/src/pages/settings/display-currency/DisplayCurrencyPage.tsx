import './display-currency-page.scss';
import { Box, CircularProgress, Container, IconButton, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSettings, useUpdateSettings } from '../../../services/settingService';
import { Currency } from '../../../enums/Currency';
import { toast } from 'react-toastify';
import { currencies } from '../constants/Currencies.ts';

const DisplayCurrencyPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const handleBack = () => {
    navigate('/settings');
  };

  const handleCurrencyChange = async (currency: Currency) => {
    if (settings?.currency === currency) return;

    try {
      await updateMutation.mutateAsync({ currency });
      toast.success(t('CURRENCY_UPDATED_SUCCESS'));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t('CURRENCY_UPDATE_ERROR');
      toast.error(errorMessage);
    }
  };

  return (
    <Container maxWidth="md" id="display-currency-page">
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
          {t('DISPLAY_CURRENCY')}
        </Typography>
      </Box>

      {isLoading ? (
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      ) : (
        <List className="currency-list">
          {currencies.map((curr) => {
            const isSelected = settings?.currency === curr.value;
            return (
              <ListItem
                key={curr.value}
                disablePadding
                className="currency-list-item"
              >
                <ListItemButton
                  onClick={() => handleCurrencyChange(curr.value)}
                  disabled={updateMutation.isPending}
                  className={`currency-button ${isSelected ? 'selected' : ''}`}
                >
                  <ListItemText
                    primary={`${curr.value} (${t(curr.labelKey)})`}
                    className="currency-text"
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

export default DisplayCurrencyPage;
