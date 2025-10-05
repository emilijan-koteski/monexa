import { Navigate, Outlet } from 'react-router';
import { isAuthenticated } from '../../services/authService';

const AuthRoute = () => {
  if (isAuthenticated()) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};

export default AuthRoute;
