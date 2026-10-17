import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { tokenUtils } from '../../utils/tokenUtils';
import { sessionStorageUtils } from '../../utils/storage';

const AuthenticatedRedirect = () => {
  const [destination] = useState(() => sessionStorageUtils.getReturnTo() ?? '/home');

  useEffect(() => {
    sessionStorageUtils.clearReturnTo();
  }, []);

  return <Navigate to={destination} replace />;
};

const AuthRoute = () => {
  if (tokenUtils.isAuthenticated()) {
    return <AuthenticatedRedirect />;
  }

  return <Outlet />;
};

export default AuthRoute;
