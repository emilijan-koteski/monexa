import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  Box,
  Typography,
  Tooltip
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLanguage, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../i18n.ts';
import { Language } from '../../enums/Language.ts';

interface LanguageOption {
  code: Language;
  nativeName: string;
  displayCode: string;
}

const languageOptions: LanguageOption[] = [
  { code: Language.EN, nativeName: 'English', displayCode: 'EN' },
  { code: Language.MK, nativeName: 'Македонски', displayCode: 'MK' },
];

const LanguageChange = () => {
  const { t, i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const currentLanguage = languageOptions.find(lang => lang.code === i18n.language) || languageOptions[0];

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageSelect = (languageCode: Language) => {
    changeLanguage(languageCode);
    handleClose();
  };

  return (
    <>
      <Tooltip title={t('CHANGE_LANGUAGE')}>
        <IconButton
          onClick={handleClick}
          sx={{
            minHeight: '46px',
            color: 'text.primary',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '8px 12px',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FontAwesomeIcon icon={faLanguage} size="sm" />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {currentLanguage.displayCode}
            </Typography>
            <FontAwesomeIcon icon={faChevronDown} size="xs" />
          </Box>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: '#251e4e',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            minWidth: '140px',
            mt: 1,
          },
        }}
      >
        {languageOptions.map((language) => (
          <MenuItem
            key={language.code}
            onClick={() => handleLanguageSelect(language.code)}
            selected={language.code === i18n.language}
            sx={{
              py: 1.5,
              px: 2,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              },
              '&.Mui-selected': {
                backgroundColor: 'rgba(102, 105, 255, 0.2)',
                '&:hover': {
                  backgroundColor: 'rgba(102, 105, 255, 0.3)',
                },
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                {language.nativeName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                {language.displayCode}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageChange;
