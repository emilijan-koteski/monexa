import './home-page.scss';
import {useTranslation} from 'react-i18next';

function HomePage() {
  const {t} = useTranslation();

  return (
    <div className="home-page">
      <h1>{t('WELCOME_MESSAGE')}</h1>
      <p>{t('APP_TAGLINE')}</p>
      <p>home-page-works!</p>
    </div>
  );
}

export default HomePage;
