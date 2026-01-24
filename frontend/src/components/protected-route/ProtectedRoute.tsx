import { Navigate, Outlet } from 'react-router';
import { tokenUtils } from '../../utils/tokenUtils';

const ProtectedRoute = () => {
  if (!tokenUtils.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
