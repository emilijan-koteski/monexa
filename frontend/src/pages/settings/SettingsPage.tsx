import { Box, Container, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const SettingsPage = () => {
  const { t } = useTranslation();

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
          {t('SETTINGS')}
        </Typography>
        <Paper sx={{ p: 3, backgroundColor: 'rgba(37, 30, 78, 0.95)' }}>
          <Typography variant="body1" color="text.secondary">
            Settings page content will be implemented here.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default SettingsPage;
