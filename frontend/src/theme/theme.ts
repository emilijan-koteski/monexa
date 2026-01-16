import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e63573',
      light: '#ef5c8c',
      dark: '#ca1f58',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6669ff',
      light: '#8689ff',
      dark: '#4447e5',
      contrastText: '#ffffff',
    },
    success: {
      main: '#93e700',
      light: '#a9f126',
      dark: '#76c300',
      contrastText: '#000000',
    },
    error: {
      main: '#e53c38',
      light: '#eb605d',
      dark: '#c12824',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f3e600',
      light: '#f5ed33',
      dark: '#d9cf00',
      contrastText: '#000000',
    },
    info: {
      main: '#55ead4',
      light: '#7aeede',
      dark: '#3ad1bc',
      contrastText: '#000000',
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
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 16,
          '&:last-child': {
            paddingBottom: 16,
          },
        },
      },
    },
  },
});

export default theme;
