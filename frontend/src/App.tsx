import theme from './theme/theme.ts';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import AppRoutes from './routes/routes.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/toast.scss';
import { enGB, mk } from 'date-fns/locale';
import { Language } from './enums/Language.ts';
import { getLanguage } from './utils/storage.ts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const currentLanguage = getLanguage();
  const adapterLocale = currentLanguage === Language.MK ? mk : enGB;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={adapterLocale}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline/>
          <AppRoutes/>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme={theme.palette.mode}
          />
        </ThemeProvider>
      </QueryClientProvider>
    </LocalizationProvider>
  );
}

export default App;
