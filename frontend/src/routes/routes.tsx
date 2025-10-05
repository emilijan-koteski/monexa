import LandingPage from '../pages/landing/LandingPage.tsx';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { lazy, Suspense } from 'react';
import Loader from '../components/loader/Loader.tsx';
import AppLayout from '../layouts/AppLayout.tsx';
import ProtectedRoute from '../components/protected-route/ProtectedRoute.tsx';
import AuthRoute from '../components/auth-route/AuthRoute.tsx';

const HomePage = lazy(() => import('../pages/home/HomePage.tsx'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage.tsx'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage.tsx'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage.tsx'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage.tsx'));

function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader/>}>
        <Routes>
          {/* Public routes without layout */}
          <Route path="/" element={<LandingPage/>}/>

          {/* Auth routes - redirect to /home if already logged in */}
          <Route element={<AuthRoute/>}>
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/register" element={<RegisterPage/>}/>
          </Route>

          {/* Protected routes with layout */}
          <Route element={<ProtectedRoute/>}>
            <Route element={<AppLayout/>}>
              <Route path="/home" element={<HomePage/>}/>
              <Route path="/profile" element={<ProfilePage/>}/>
              <Route path="/settings" element={<SettingsPage/>}/>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/"/>}/>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
