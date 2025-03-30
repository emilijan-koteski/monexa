import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import '@fontsource/tilt-neon';
import '@fontsource/roboto';
import './i18n.ts'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App/>
    </StrictMode>,
)
