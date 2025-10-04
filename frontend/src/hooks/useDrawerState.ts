import { useState, useEffect } from 'react';

const DRAWER_STATE_KEY = 'monexa_drawer_expanded';

export const useDrawerState = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const stored = localStorage.getItem(DRAWER_STATE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(DRAWER_STATE_KEY, String(isExpanded));
  }, [isExpanded]);

  const toggleDrawer = () => {
    setIsExpanded((prev) => !prev);
  };

  return { isExpanded, toggleDrawer, setIsExpanded };
};
