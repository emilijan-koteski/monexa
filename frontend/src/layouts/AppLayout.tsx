import { Box, useMediaQuery, useTheme } from '@mui/material';
import { Outlet } from 'react-router';
import { useDrawerState } from '../hooks/useDrawerState';
import AppHeader from './AppHeader';
import AppDrawer from './AppDrawer';
import './AppLayout.scss';

const DRAWER_WIDTH_EXPANDED = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const AppLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isExpanded, toggleDrawer } = useDrawerState();

  const drawerWidth = isExpanded ? DRAWER_WIDTH_EXPANDED : DRAWER_WIDTH_COLLAPSED;
  const showDrawer = !isMobile || isExpanded;

  return (
    <Box id="app-layout">
      <AppHeader onMenuClick={toggleDrawer} />

      <Box className="layout-body">
        <AppDrawer
          isExpanded={isExpanded}
          isMobile={isMobile}
          drawerWidth={drawerWidth}
          open={showDrawer}
          onClose={() => toggleDrawer()}
        />

        <Box
          component="main"
          className="layout-main"
          sx={{
            marginLeft: isMobile ? 0 : `${drawerWidth}px`,
            transition: 'margin-left 0.3s ease',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;
