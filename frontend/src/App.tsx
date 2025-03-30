import theme from './theme/theme.ts';
import {CssBaseline, ThemeProvider} from '@mui/material';
import AppRoutes from './routes/routes.tsx';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <AppRoutes/>
    </ThemeProvider>
  );
}

export default App;
