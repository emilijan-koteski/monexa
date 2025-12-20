import './display-currency-page.scss';
import { Container, Box, Typography, IconButton, Paper } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

const DisplayCurrencyPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/settings');
  };

  return (
    <Container maxWidth="md" id="display-currency-page">
      <Box className="page-header">
        <IconButton color='primary' onClick={handleBack} className="back-button">
          <FontAwesomeIcon icon={faArrowLeft} />
        </IconButton>
        <Typography variant="h5" color='text.primary' fontWeight='600' className="page-title">
          {t('DISPLAY_CURRENCY')}
        </Typography>
      </Box>

      <Paper className="page-content">
        <Typography variant="body1" color="text.secondary">
          {t('DISPLAY_CURRENCY_COMING_SOON')}
        </Typography>
      </Paper>
    </Container>
  );
};

export default DisplayCurrencyPage;
