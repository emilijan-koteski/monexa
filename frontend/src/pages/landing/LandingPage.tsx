import {useTranslation} from 'react-i18next';
import './landing-page.scss';
import {getLanguage} from '../../utils/storage.ts';
import {Language} from '../../enums/Language.ts';
import {Button} from '@mui/material';
import {changeLanguage} from '../../i18n.ts';

function LandingPage() {
  const {t} = useTranslation();

  const toggleLanguage = () => {
    const lng = getLanguage();
    switch (lng) {
      case Language.EN:
        changeLanguage(Language.MK);
        break;
      default:
        changeLanguage(Language.EN);
        break;
    }
  };

  return (
    <div className="landing-page">
      <h1>{t('WELCOME_MESSAGE')}</h1>
      <p>{t('APP_TAGLINE')}</p>
      <Button variant="contained" onClick={toggleLanguage}>{t('TOGGLE_LANGUAGE')}</Button>
      <p>landing-page-works!</p>
    </div>
  );
}

export default LandingPage;
