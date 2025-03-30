import {Language} from '../enums/Language.ts';

const STORAGE_KEYS = {
  LANGUAGE: 'language',
};

export const getLanguage = (): Language => {
  return localStorage.getItem(STORAGE_KEYS.LANGUAGE) as Language || Language.EN;
};

export const setLanguage = (lng: Language): void => {
  localStorage.setItem(STORAGE_KEYS.LANGUAGE, lng);
};
