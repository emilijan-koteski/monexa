import {createTheme} from '@mui/material/styles';

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
  },
});

export default theme;
