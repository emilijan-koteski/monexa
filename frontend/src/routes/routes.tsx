import LandingPage from '../pages/landing/LandingPage.tsx';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { lazy, Suspense } from 'react';
import Loader from '../components/loader/Loader.tsx';

const HomePage = lazy(() => import('../pages/home/HomePage.tsx'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage.tsx'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage.tsx'));

function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader/>}>
        <Routes>
          <Route path="/" element={<LandingPage/>}/>
          <Route path="/login" element={<LoginPage/>}/>
          <Route path="/register" element={<RegisterPage/>}/>
          <Route path="/home" element={<HomePage/>}/>
          <Route path="*" element={<Navigate to="/"/>}/>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
