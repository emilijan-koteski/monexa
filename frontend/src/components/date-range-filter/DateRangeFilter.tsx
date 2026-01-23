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
    { value: DateRangePreset.ONE_WEEK, label: t('DATE_RANGE_WEEK') },
    { value: DateRangePreset.ONE_MONTH, label: t('DATE_RANGE_MONTH') },
    { value: DateRangePreset.ONE_YEAR, label: t('DATE_RANGE_YEAR') },
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
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />
          <DatePicker
            label={t('END_DATE')}
            value={customEndDate}
            onChange={(date) => onCustomDateChange(customStartDate, date)}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />
        </Stack>
      )}
    </Box>
  );
}

export default DateRangeFilter;
