import './month-summary.scss';
import { Box, IconButton, MenuItem, Select, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faLock, faLockOpen, faMinus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import type { ComparisonResult } from '../../pages/trends/types/ComparisonResult';

interface ComparisonOption {
  value: number;
  label: string;
}

interface MonthSummaryProps {
  monthLabel: string;
  amount: string;
  comparison: ComparisonResult | null;
  comparisonMonth: number | null;
  comparisonOptions: ComparisonOption[];
  comparisonLocked: boolean;
  onComparisonChange: (month: number) => void;
  onLockToggle: () => void;
}

const MonthSummary = ({ monthLabel, amount, comparison, comparisonMonth, comparisonOptions, comparisonLocked, onComparisonChange, onLockToggle }: MonthSummaryProps) => {
  const { t } = useTranslation();

  return (
    <Box id="month-summary">
      <Box className="month-summary__left">
        <Typography variant="subtitle1" fontWeight={600}>
          {monthLabel}
        </Typography>
        {comparisonOptions.length > 0 && (
          <Box className="month-summary__comparison-label">
            <Typography variant="caption" color="text.secondary">
              {t('COMPARED_TO')}
            </Typography>
            <Select
              value={comparisonMonth ?? ''}
              onChange={e => onComparisonChange(Number(e.target.value))}
              size="small"
              variant="standard"
              className="month-summary__comparison-select"
            >
              {comparisonOptions.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            <IconButton
              size="small"
              onClick={onLockToggle}
              className={`month-summary__lock-button ${comparisonLocked ? 'locked' : ''}`}
            >
              <FontAwesomeIcon icon={comparisonLocked ? faLock : faLockOpen} />
            </IconButton>
          </Box>
        )}
      </Box>
      <Box className="month-summary__right" data-sentiment={comparison?.sentiment}>
        <Typography variant="h6" fontWeight="600">
          {amount}
        </Typography>
        {comparison !== null && comparison.percentage !== null && (
          <Box className="month-summary__change">
            <FontAwesomeIcon icon={comparison.direction === 'up' ? faArrowUp : comparison.direction === 'down' ? faArrowDown : faMinus} size="xs"/>
            <Typography variant="caption">
              {comparison.percentage.toFixed(1)}%
            </Typography>
          </Box>
        )}
        {comparison !== null && comparison.percentage === null && (
          <Typography variant="caption" color="text.secondary">
            {t('NO_DATA_AVAILABLE')}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default MonthSummary;
