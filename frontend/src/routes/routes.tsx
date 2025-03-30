import LandingPage from '../pages/landing/LandingPage.tsx';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router';
import {lazy, Suspense} from 'react';
import Loader from '../components/loader/Loader.tsx';

const HomePage = lazy(() => import('../pages/home/HomePage.tsx'));

function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader/>}>
        <Routes>
          <Route path="/" element={<LandingPage/>}/>
          <Route path="/home" element={<HomePage/>}/>
          <Route path="*" element={<Navigate to="/"/>}/>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
