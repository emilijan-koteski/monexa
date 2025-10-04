import { useState } from 'react';
import {
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  List,
  Tooltip,
  Menu,
  MenuItem,
  Box,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faCircle } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { NavigationItem } from '../config/navigation';
import './NavItem.scss';

interface NavItemProps {
  item: NavigationItem;
  isExpanded: boolean;
  depth?: number;
}

const NavItem = ({ item, isExpanded, depth = 0 }: NavItemProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const hasChildren = item.children && item.children.length > 0;

  const isActive = item.path
    ? (location.pathname === item.path ||
       (hasChildren && location.pathname.startsWith(item.path + '/')))
    : false;

  const menuOpen = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!isExpanded && hasChildren) {
      setAnchorEl(event.currentTarget);
    } else if (hasChildren) {
      setOpen(!open);
    } else if (item.path) {
      navigate(item.path);
      handleMenuClose();
    }
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (path?: string) => {
    if (path) {
      navigate(path);
    }
    handleMenuClose();
  };

  const buttonClasses = [
    'nav-item-button',
    isActive && 'active',
    !isExpanded && 'collapsed',
    depth > 0 && 'nested',
    depth > 0 && `depth-${depth}`,
  ]
    .filter(Boolean)
    .join(' ');

  const iconClasses = ['nav-item-icon', !isExpanded && 'collapsed']
    .filter(Boolean)
    .join(' ');

  const button = (
    <ListItemButton
      onClick={handleClick}
      className={buttonClasses}
      selected={isActive}
    >
      <ListItemIcon className={iconClasses}>
        <Box className="icon-wrapper">
          <FontAwesomeIcon icon={item.icon} />
          {!isExpanded && hasChildren && (
            <FontAwesomeIcon icon={faCircle} className="has-children-indicator" />
          )}
        </Box>
      </ListItemIcon>

      {isExpanded && (
        <>
          <ListItemText primary={t(item.label)} className="nav-item-text" />
          {hasChildren && (
            <FontAwesomeIcon
              icon={open ? faChevronUp : faChevronDown}
              className="nav-item-expand-icon"
            />
          )}
        </>
      )}
    </ListItemButton>
  );

  const NestedMenuItem = ({ child }: { child: NavigationItem }) => {
    const [nestedAnchorEl, setNestedAnchorEl] = useState<null | HTMLElement>(null);
    const childHasChildren = child.children && child.children.length > 0;

    const isChildActive = child.path
      ? (location.pathname === child.path ||
         (childHasChildren && location.pathname.startsWith(child.path + '/')))
      : false;

    const handleNestedOpen = (event: React.MouseEvent<HTMLElement>) => {
      setNestedAnchorEl(event.currentTarget);
    };

    const handleNestedClose = () => {
      setNestedAnchorEl(null);
    };

    const menuItemClasses = ['nav-menu-item', isChildActive && 'active']
      .filter(Boolean)
      .join(' ');

    if (childHasChildren) {
      return (
        <>
          <MenuItem
            key={child.id}
            className={menuItemClasses}
            onClick={handleNestedOpen}
          >
            <FontAwesomeIcon icon={child.icon} className="menu-item-icon" />
            <span>{t(child.label)}</span>
            <FontAwesomeIcon icon={faChevronDown} className="menu-item-chevron" style={{ transform: 'rotate(-90deg)' }} />
          </MenuItem>
          <Menu
            anchorEl={nestedAnchorEl}
            open={Boolean(nestedAnchorEl)}
            onClose={handleNestedClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            className="nav-item-menu"
          >
            {child.children!.map((nestedChild) => {
              const isNestedActive = nestedChild.path === location.pathname;
              const nestedClasses = ['nav-menu-item', isNestedActive && 'active']
                .filter(Boolean)
                .join(' ');

              return (
                <MenuItem
                  key={nestedChild.id}
                  onClick={() => {
                    handleMenuItemClick(nestedChild.path);
                    handleNestedClose();
                  }}
                  className={nestedClasses}
                >
                  <FontAwesomeIcon icon={nestedChild.icon} className="menu-item-icon" />
                  <span>{t(nestedChild.label)}</span>
                </MenuItem>
              );
            })}
          </Menu>
        </>
      );
    }

    return (
      <MenuItem
        key={child.id}
        onClick={() => handleMenuItemClick(child.path)}
        className={menuItemClasses}
      >
        <FontAwesomeIcon icon={child.icon} className="menu-item-icon" />
        <span>{t(child.label)}</span>
      </MenuItem>
    );
  };

  return (
    <div id="nav-item">
      {isExpanded ? (
        button
      ) : (
        <Tooltip title={t(item.label)} placement="right" arrow>
          {button}
        </Tooltip>
      )}

      {!isExpanded && hasChildren && (
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          className="nav-item-menu"
        >
          {item.children!.map((child) => (
            <NestedMenuItem key={child.id} child={child} />
          ))}
        </Menu>
      )}

      {hasChildren && isExpanded && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding className="nav-item-children">
            {item.children!.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                isExpanded={isExpanded}
                depth={depth + 1}
              />
            ))}
          </List>
        </Collapse>
      )}
    </div>
  );
};

export default NavItem;
