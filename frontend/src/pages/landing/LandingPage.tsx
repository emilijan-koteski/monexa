import { useTranslation } from 'react-i18next';
import './landing-page.scss';
import LanguageChange from '../../components/language-change/LanguageChange.tsx';

function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="landing-page">
      <h1>{t('WELCOME_MESSAGE')}</h1>
      <p>{t('APP_TAGLINE')}</p>
      <LanguageChange/>
      <p>landing-page-works!</p>
    </div>
  );
}

export default LandingPage;
