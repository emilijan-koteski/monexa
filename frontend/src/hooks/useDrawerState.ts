import { useState, useEffect } from 'react';
import { localStorageUtils } from '../utils/storage';

export const useDrawerState = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const stored = localStorageUtils.getDrawerState();
    return stored === 'true';
  });

  useEffect(() => {
    localStorageUtils.setDrawerState(String(isExpanded));
  }, [isExpanded]);

  const toggleDrawer = () => {
    setIsExpanded((prev) => !prev);
  };

  return { isExpanded, toggleDrawer, setIsExpanded };
};
