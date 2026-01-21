import { Drawer, List, Box } from '@mui/material';
import { navigationItems } from '../config/navigation';
import NavItem from './NavItem';
import './app-drawer.scss';

interface AppDrawerProps {
  isExpanded: boolean;
  isMobile: boolean;
  drawerWidth: number;
  open: boolean;
  onClose: () => void;
}

const AppDrawer = ({ isExpanded, isMobile, drawerWidth, open, onClose }: AppDrawerProps) => {

  const drawerContent = (
    <Box className='drawer-content'>
      <List>
        {navigationItems.map((item) => (
          <NavItem key={item.id} item={item} isExpanded={isExpanded} />
        ))}
      </List>
    </Box>
  );

  return  (
    <Drawer
      id='app-drawer'
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? open : true}
      keepMounted={isMobile}
      onClose={isMobile ? onClose : undefined}
      slotProps={{
        paper: {
          className: 'drawer-paper',
          style: { width: drawerWidth },
        },
      }}
    >
      {drawerContent}
    </Drawer>
  )
};

export default AppDrawer;
