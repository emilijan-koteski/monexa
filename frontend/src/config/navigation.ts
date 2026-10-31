import { faHome, faChartPie, faChartBar, faPeopleGroup } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type NavigationItem = {
  id: string;
  label: string;
  icon: IconDefinition;
  path?: string;
  children?: NavigationItem[];
};

export const navigationItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'HOME',
    icon: faHome,
    path: '/home'
  },
  {
    id: 'groups',
    label: 'GROUPS',
    icon: faPeopleGroup,
    path: '/groups'
  },
  {
    id: 'categories',
    label: 'CATEGORIES',
    icon: faChartPie,
    path: '/categories'
  },
  {
    id: 'trends',
    label: 'TRENDS',
    icon: faChartBar,
    path: '/trends'
  },
];
