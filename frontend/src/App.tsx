import theme from './theme/theme.ts';
import { CssBaseline, ThemeProvider } from '@mui/material';
import AppRoutes from './routes/routes.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline/>
        <AppRoutes/>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
