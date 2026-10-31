import type { ChangeEvent, FocusEvent } from 'react';
import { TextField, type TextFieldProps } from '@mui/material';
import { formatAmount, stripCommas } from '../../utils/amount';

type AmountFieldProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
};

/** Amount input that keeps thousands separators, allows two decimals and selects everything on focus. */
function AmountField({ value, onChange, onBlur, slotProps, 'aria-label': ariaLabel, ...rest }: AmountFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = stripCommas(event.target.value);
    if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
      onChange(formatAmount(raw.replace(/^0+(\d)/, '$1')));
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = stripCommas(event.target.value);
    if (raw.includes('.')) {
      onChange(formatAmount(raw.replace(/\.?0+$/, '')));
    }
    onBlur?.(event);
  };

  return (
    <TextField
      {...rest}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={(event) => event.target.select()}
      slotProps={{ ...slotProps, htmlInput: { inputMode: 'decimal', autoComplete: 'off', 'aria-label': ariaLabel } }}
    />
  );
}

export default AmountField;
