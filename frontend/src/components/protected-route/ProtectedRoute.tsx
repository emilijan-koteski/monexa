import { Navigate, Outlet, useLocation } from 'react-router';
import { tokenUtils } from '../../utils/tokenUtils';
import { usePendingDocuments } from '../../services/legalDocumentService';
import { ENV } from '../../config/env';
import Loader from '../loader/Loader';

const ProtectedRoute = () => {
  const location = useLocation();
  const isAuthenticated = tokenUtils.isAuthenticated();

  const isLegalAcceptancePage = location.pathname === '/legal-acceptance';

  const { data, isLoading } = usePendingDocuments({
    enabled: ENV.LEGAL_COMPLIANCE_ENABLED && isAuthenticated && !isLegalAcceptancePage,
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (ENV.LEGAL_COMPLIANCE_ENABLED && isLoading && !isLegalAcceptancePage) {
    return <Loader />;
  }

  if (ENV.LEGAL_COMPLIANCE_ENABLED && !isLegalAcceptancePage && data?.hasPendingDocuments) {
    sessionStorage.setItem('redirectAfterLegal', location.pathname);
    return <Navigate to="/legal-acceptance" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
