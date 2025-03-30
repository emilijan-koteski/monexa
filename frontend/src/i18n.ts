import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import en from './locales/en.json';
import mk from './locales/mk.json';
import {getLanguage, setLanguage} from './utils/storage.ts';

const language = getLanguage();

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: {translation: en},
            mk: {translation: mk},
        },
        lng: language,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

export const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng).then(() => {
        setLanguage(lng);
    });
};

export default i18n;
