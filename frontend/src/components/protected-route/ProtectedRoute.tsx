import { Navigate, Outlet } from 'react-router';
import { isAuthenticated } from '../../services/authService';

const ProtectedRoute = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
