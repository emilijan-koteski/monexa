import './date-range-filter.scss';
import { Box, Chip, Stack } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useTranslation } from 'react-i18next';
import { DateRangePreset } from '../../enums/DateRangePreset';

interface DateRangeFilterProps {
  preset: DateRangePreset;
  customStartDate: Date | null;
  customEndDate: Date | null;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomDateChange: (start: Date | null, end: Date | null) => void;
}

function DateRangeFilter({
  preset,
  customStartDate,
  customEndDate,
  onPresetChange,
  onCustomDateChange,
}: DateRangeFilterProps) {
  const { t } = useTranslation();

  const presets = [
    { value: DateRangePreset.OVERALL, label: t('DATE_RANGE_OVERALL') },
    { value: DateRangePreset.LAST_WEEK, label: t('DATE_RANGE_LAST_WEEK') },
    { value: DateRangePreset.LAST_MONTH, label: t('DATE_RANGE_LAST_MONTH') },
    { value: DateRangePreset.LAST_YEAR, label: t('DATE_RANGE_LAST_YEAR') },
    { value: DateRangePreset.THIS_WEEK, label: t('DATE_RANGE_THIS_WEEK') },
    { value: DateRangePreset.THIS_MONTH, label: t('DATE_RANGE_THIS_MONTH') },
    { value: DateRangePreset.THIS_YEAR, label: t('DATE_RANGE_THIS_YEAR') },
    { value: DateRangePreset.CUSTOM, label: t('DATE_RANGE_CUSTOM') },
  ];

  return (
    <Box id="date-range-filter">
      <Stack direction="row" gap={1} flexWrap="wrap">
        {presets.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            onClick={() => onPresetChange(p.value)}
            color={preset === p.value ? 'primary' : 'default'}
            variant={preset === p.value ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {preset === DateRangePreset.CUSTOM && (
        <Stack direction="row" gap={1.5} className="custom-date-pickers">
          <DatePicker
            label={t('START_DATE')}
            value={customStartDate}
            onChange={(date) => onCustomDateChange(date, customEndDate)}
            slotProps={{ textField: { size: 'small', fullWidth: true }, field: { clearable: true } }}
          />
          <DatePicker
            label={t('END_DATE')}
            value={customEndDate}
            onChange={(date) => onCustomDateChange(customStartDate, date)}
            slotProps={{ textField: { size: 'small', fullWidth: true }, field: { clearable: true } }}
          />
        </Stack>
      )}
    </Box>
  );
}

export default DateRangeFilter;
