import { createTheme, alpha } from '@mui/material/styles';
import '@mui/x-date-pickers/themeAugmentation';

const palette = {
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
};

const borderRadius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
};

const borders = {
  subtle: `1px solid ${alpha('#ffffff', 0.1)}`,
  hover: alpha('#ffffff', 0.2),
  focus: alpha('#ffffff', 0.3),
};

const shadows = {
  paper: '0 20px 40px rgba(0, 0, 0, 0.3)',
};

const transitions = {
  fast: 'all 0.15s ease',
  normal: 'all 0.3s ease',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    ...palette,
  },
  typography: {
    fontFamily: '\'Tilt Neon\', Roboto, Helvetica, Arial, sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.background.default,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          border: 'none',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: 'none',
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: palette.background.paper,
          border: borders.subtle,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.paper,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: palette.background.paper,
          border: borders.subtle,
          borderRadius: borderRadius.lg,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: palette.text.primary,
          fontSize: '1.5rem',
          fontWeight: 600,
          padding: '20px 24px 16px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px 20px',
          gap: '0.5rem',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.05),
          borderRadius: borderRadius.md,
          color: palette.text.primary,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: borders.hover,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: borders.focus,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.secondary.main,
            borderWidth: '2px',
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.error.main,
          },
          '&.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.error.main,
            borderWidth: '2px',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: palette.text.secondary,
          '&.Mui-focused': {
            color: palette.secondary.main,
          },
          '&.Mui-error': {
            color: palette.error.main,
          },
        },
      },
    },
    MuiInputAdornment: {
      styleOverrides: {
        root: {
          color: palette.text.secondary,
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: '4px',
          marginTop: '6px',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: palette.text.secondary,
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        popupIndicator: {
          color: palette.text.secondary,
        },
        clearIndicator: {
          color: palette.text.secondary,
        },
        paper: {
          borderRadius: borderRadius.sm,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.background.paper,
          border: borders.subtle,
          borderRadius: borderRadius.sm,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: palette.text.primary,
          '&:hover': {
            backgroundColor: alpha(palette.primary.main, 0.1),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(palette.primary.main, 0.2),
            '&:hover': {
              backgroundColor: alpha(palette.primary.main, 0.3),
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        text: {
          color: palette.text.secondary,
          textTransform: 'none',
        },
        outlined: {
          color: palette.text.secondary,
          borderColor: alpha('#ffffff', 0.1),
          textTransform: 'none',
          padding: '0.5rem 1rem',
          borderRadius: borderRadius.sm,
          '&:hover': {
            borderColor: borders.focus,
            backgroundColor: alpha('#ffffff', 0.05),
          },
        },
        contained: {
          textTransform: 'none',
          padding: '0.5rem 1rem',
          borderRadius: borderRadius.sm,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: palette.background.paper,
          border: borders.subtle,
          color: palette.text.primary,
          fontSize: '0.875rem',
          borderRadius: borderRadius.sm,
          padding: '8px 12px',
        },
        arrow: {
          color: palette.background.paper,
          '&::before': {
            border: borders.subtle,
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
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.sm,
          transition: transitions.fast,
        },
        colorPrimary: {
          color: palette.primary.main,
          backgroundColor: alpha(palette.primary.main, 0.1),
          '&:hover': {
            backgroundColor: alpha(palette.primary.main, 0.2),
            color: palette.primary.light,
          },
        },
        colorSecondary: {
          color: palette.secondary.main,
          backgroundColor: alpha(palette.secondary.main, 0.1),
          '&:hover': {
            backgroundColor: alpha(palette.secondary.main, 0.2),
            color: palette.secondary.light,
          },
        },
        colorError: {
          color: palette.error.main,
          backgroundColor: alpha(palette.error.main, 0.1),
          '&:hover': {
            backgroundColor: alpha(palette.error.main, 0.2),
            color: palette.error.light,
          },
        },
        colorSuccess: {
          color: palette.success.main,
          backgroundColor: alpha(palette.success.main, 0.1),
          '&:hover': {
            backgroundColor: alpha(palette.success.main, 0.2),
            color: palette.success.light,
          },
        },
        colorWarning: {
          color: palette.warning.main,
          backgroundColor: alpha(palette.warning.main, 0.1),
          '&:hover': {
            backgroundColor: alpha(palette.warning.main, 0.2),
            color: palette.warning.light,
          },
        },
        colorInfo: {
          color: palette.info.main,
          backgroundColor: alpha(palette.info.main, 0.1),
          '&:hover': {
            backgroundColor: alpha(palette.info.main, 0.2),
            color: palette.info.light,
          },
        },
      },
    },
    MuiPickersOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.05),
          borderRadius: borderRadius.md,
          '& .MuiPickersOutlinedInput-notchedOutline': {
            borderColor: borders.hover,
          },
          '&:hover:not(.Mui-focused) .MuiPickersOutlinedInput-notchedOutline': {
            borderColor: borders.focus,
          },
          '&.Mui-focused .MuiPickersOutlinedInput-notchedOutline': {
            borderColor: `${palette.secondary.main} !important`,
            borderWidth: '2px',
          },
        },
      },
    },
    MuiPickersInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.05),
          borderRadius: borderRadius.md,
        },
      },
    },
    MuiPickerPopper: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.background.paper,
          border: borders.subtle,
          borderRadius: borderRadius.md,
        },
      },
    },
    MuiDateCalendar: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
        },
      },
    },
    MuiPickersCalendarHeader: {
      styleOverrides: {
        root: {
          color: palette.text.primary,
        },
        label: {
          color: palette.text.primary,
        },
        switchViewButton: {
          color: palette.text.secondary,
          '&:hover': {
            backgroundColor: alpha(palette.primary.main, 0.1),
          },
        },
      },
    },
    MuiPickersArrowSwitcher: {
      styleOverrides: {
        button: {
          color: palette.text.secondary,
          '&:hover': {
            backgroundColor: alpha(palette.primary.main, 0.1),
          },
        },
      },
    },
    MuiDayCalendar: {
      styleOverrides: {
        weekDayLabel: {
          color: palette.text.secondary,
        },
      },
    },
    MuiPickersDay: {
      styleOverrides: {
        root: {
          color: palette.text.primary,
          '&:hover': {
            backgroundColor: alpha(palette.primary.main, 0.1),
          },
          '&.Mui-selected': {
            backgroundColor: palette.primary.main,
            color: palette.primary.contrastText,
            '&:hover': {
              backgroundColor: palette.primary.dark,
            },
          },
          '&.MuiPickersDay-today': {
            borderColor: palette.secondary.main,
          },
        },
      },
    },
    MuiYearCalendar: {
      styleOverrides: {
        button: {
          color: palette.text.primary,
          '&:hover': {
            backgroundColor: alpha(palette.primary.main, 0.1),
          },
          '&.Mui-selected': {
            backgroundColor: palette.primary.main,
            color: palette.primary.contrastText,
          },
        },
      },
    },
    MuiMonthCalendar: {
      styleOverrides: {
        button: {
          color: palette.text.primary,
          '&:hover': {
            backgroundColor: alpha(palette.primary.main, 0.1),
          },
          '&.Mui-selected': {
            backgroundColor: palette.primary.main,
            color: palette.primary.contrastText,
          },
        },
      },
    },
  },
});

export default theme;
