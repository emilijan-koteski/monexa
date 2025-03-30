import theme from "./theme/theme.ts";
import {Button, CssBaseline, ThemeProvider} from "@mui/material";
import {changeLanguage} from './i18n.ts';
import {getLanguage} from "./utils/storage.ts";
import {useTranslation} from "react-i18next";

function App() {
    const {t} = useTranslation()

    const toggleLanguage = () => {
        const lng = getLanguage();
        switch (lng) {
            case 'en':
                changeLanguage('mk');
                break;
            default:
                changeLanguage('en');
                break;
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <div>
                <h1>{t('WELCOME_MESSAGE')}</h1>
                <p>{t('APP_TAGLINE')}</p>
            </div>
            <div>
                <Button variant='contained' onClick={toggleLanguage}>{t('TOGGLE_LANGUAGE')}</Button>
            </div>
        </ThemeProvider>
    )
}

export default App
