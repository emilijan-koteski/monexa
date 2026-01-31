import './date-selector.scss';
import { useState, useRef } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Box, Typography, Chip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { format, isToday } from 'date-fns';
import { enGB, mk } from 'date-fns/locale';
import { getLanguage } from '../../utils/storage';
import { Language } from '../../enums/Language';

interface DateSelectorProps {
  selectedDate: Date;
  onChange: (date: Date | null) => void;
}

function DateSelector({ selectedDate, onChange }: DateSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const currentLanguage = getLanguage();
  const locale = currentLanguage === Language.MK ? mk : enGB;
  const formattedDate = format(selectedDate, 'EEEE, d MMMM, yyyy', { locale });
  const isTodaySelected = isToday(selectedDate);

  const handleDateChange = (newDate: Date | null) => {
    if (newDate) {
      onChange(newDate);
    }
    setOpen(false);
  };

  return (
    <Box id="date-selector" onClick={() => setOpen(true)} ref={anchorRef}>
      <Box className="date-display">
        <FontAwesomeIcon icon={faCalendar} className="calendar-icon" />
        <Box className="date-text">
          <Typography variant="body2" className="date-label">
            {t('SELECTED_DATE')}
          </Typography>
          <Typography variant="h6" className="date-value">
            {formattedDate}
          </Typography>
        </Box>
        {isTodaySelected && (
          <Chip label={t('TODAY')} className="today-chip" size="small" />
        )}
      </Box>

      <Box onClick={(e) => e.stopPropagation()}>
        <DatePicker
          value={selectedDate}
          onChange={handleDateChange}
          open={open}
          onClose={() => setOpen(false)}
          slotProps={{
            textField: { sx: { display: 'none' } },
            popper: {
              anchorEl: anchorRef.current,
              modifiers: [
                {
                  name: 'offset',
                  options: {
                    offset: [0, 8],
                  },
                },
              ],
            },
            actionBar: {
              actions: ['today', 'cancel'],
            },
          }}
        />
      </Box>
    </Box>
  );
}

export default DateSelector;
