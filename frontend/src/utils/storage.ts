const STORAGE_KEYS = {
    LANGUAGE: 'language',
};

export const getLanguage = (): string => {
    return localStorage.getItem(STORAGE_KEYS.LANGUAGE) || 'en';
};

export const setLanguage = (lng: string): void => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lng);
};
