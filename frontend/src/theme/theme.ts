import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e63573',
    },
    secondary: {
      main: '#6669ff',
    },
    success: {
      main: '#93e700',
    },
    error: {
      main: '#ff6b35',
    },
    warning: {
      main: '#ffa726',
    },
    info: {
      main: '#26c6da',
    },
    background: {
      default: '#1b143d',
      paper: '#251e4e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#777ab6',
    },
  },
  typography: {
    fontFamily: '\'Tilt Neon\', Roboto, Helvetica, Arial, sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#1b143d',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#251e4e',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
          fontSize: '0.875rem',
          borderRadius: '8px',
          padding: '8px 12px',
        },
        arrow: {
          color: '#251e4e',
          '&::before': {
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        },
      },
    },
  },
});

export default theme;
