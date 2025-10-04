import { AppBar, IconButton, Toolbar, Typography, Box } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import LanguageChange from '../components/language-change/LanguageChange';
import { useTranslation } from 'react-i18next';
import './AppHeader.scss';

interface AppHeaderProps {
  onMenuClick: () => void;
}

const AppHeader = ({ onMenuClick }: AppHeaderProps) => {
  const { t } = useTranslation();

  return (
    <AppBar id="app-header" elevation={0}>
      <Toolbar className="header-toolbar">
        <Box className="header-lhs">
          <IconButton
            className="menu-button"
            aria-label="toggle drawer"
            onClick={onMenuClick}
          >
            <FontAwesomeIcon icon={faBars} />
          </IconButton>

          <Typography variant="h5" noWrap component="div" className="app-title">
            {t('APP_TITLE')}
          </Typography>
        </Box>

        <Box className="header-rhs">
          <LanguageChange />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
