import './language-change.scss';
import { useState } from 'react';
import { IconButton, Menu, MenuItem, Box, Typography, Tooltip } from '@mui/material';
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

  const currentLanguage =
    languageOptions.find((lang) => lang.code === i18n.language) || languageOptions[0];

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
    <Box id="language-change">
      <Tooltip title={t('CHANGE_LANGUAGE')}>
        <IconButton onClick={handleClick} className="language-button">
          <Box className="button-content">
            <FontAwesomeIcon icon={faLanguage} size="sm" />
            <Typography variant="body2" fontWeight={600}>
              {currentLanguage.displayCode}
            </Typography>
            <FontAwesomeIcon icon={faChevronDown} size="xs" />
          </Box>
        </IconButton>
      </Tooltip>
      <Menu
        id="language-menu"
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
      >
        {languageOptions.map((language) => (
          <MenuItem
            key={language.code}
            onClick={() => handleLanguageSelect(language.code)}
            selected={language.code === i18n.language}
            className="language-option"
          >
            <Box className="option-content">
              <Typography variant="body2">{language.nativeName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {language.displayCode}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default LanguageChange;
