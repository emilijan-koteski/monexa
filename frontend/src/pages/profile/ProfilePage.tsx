import { Box, Container, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const ProfilePage = () => {
  const { t } = useTranslation();

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
          {t('PROFILE')}
        </Typography>
        <Paper sx={(theme) => ({ p: 3, backgroundColor: theme.palette.background.paper })}>
          <Typography variant="body1" color="text.secondary">
            Profile page content will be implemented here.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default ProfilePage;
