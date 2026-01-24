import { Navigate, Outlet } from 'react-router';
import { tokenUtils } from '../../utils/tokenUtils';

const AuthRoute = () => {
  if (tokenUtils.isAuthenticated()) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};

export default AuthRoute;
