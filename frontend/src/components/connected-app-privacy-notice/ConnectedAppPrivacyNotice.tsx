import './connected-app-privacy-notice.scss';
import { Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ENV } from '../../config/env.ts';

const PRIVACY_POLICY_PATH = '/privacy-policy';

const ConnectedAppPrivacyNotice = () => {
  const { t } = useTranslation();

  return (
    <Typography variant="body2" color="text.secondary" className="connected-app-privacy-notice">
      {t('CONNECTED_APP_DATA_SHARING_NOTICE')}
      {ENV.LEGAL_COMPLIANCE_ENABLED && (
        <>
          {' '}
          {t('CONNECTED_APP_PRIVACY_POLICY_PREFIX')}{' '}
          <Link href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener noreferrer">
            {t('PRIVACY_POLICY')}
          </Link>
          .
        </>
      )}
    </Typography>
  );
};

export default ConnectedAppPrivacyNotice;
