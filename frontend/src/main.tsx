import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/tilt-neon/index.css';
import '@fontsource/roboto/index.css';
import './i18n.ts';
import App from './App.tsx';
import { seedHistory } from './navigation/appHistory';

seedHistory();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App/>
  </StrictMode>,
);
