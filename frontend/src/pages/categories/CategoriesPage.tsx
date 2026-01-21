import './categories-page.scss';
import { Box, Container, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const CategoriesPage = () => {
  const { t } = useTranslation();

  return (
    <Container maxWidth="md" id="categories-page">
      <Box className="categories-header">
        <Typography variant="h4" color="text.primary" fontWeight="600" className="categories-title">
          {t('CATEGORIES')}
        </Typography>
      </Box>

      <Box className="categories-content">
        <Typography variant="body1" color="text.secondary">
          Categories page content will be implemented here.
        </Typography>
      </Box>
    </Container>
  );
};

export default CategoriesPage;
