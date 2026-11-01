import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AppDialog from '../app-dialog/AppDialog';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { Group } from '../../types/groups';
import { CategoryType } from '../../enums/CategoryType';
import { useCategories } from '../../services/categoryService';
import { usePaymentMethods } from '../../services/paymentMethodService';
import { useUpdateMe } from '../../services/groupService';
import { formatCurrencyAmount } from '../../utils/currency';
import { groupErrorMessage } from '../../utils/groupErrors';

interface GroupSyncDialogProps {
  open: boolean;
  onClose: () => void;
  group: Group;
}

const EXAMPLE_TOTAL = 3000;
const EXAMPLE_PEOPLE = 3;

function GroupSyncDialog({ open, onClose, group }: GroupSyncDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: categories } = useCategories();
  const { data: paymentMethods } = usePaymentMethods();
  const updateMe = useUpdateMe();
  const expenseCategories = (categories ?? []).filter((category) => category.type === CategoryType.EXPENSE);
  const [enabled, setEnabled] = useState(false);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('');
  const [keepRecords, setKeepRecords] = useState('keep');

  useEffect(() => {
    if (!open) {
      return;
    }
    const choices = (categories ?? []).filter((category) => category.type === CategoryType.EXPENSE);
    const travel = choices.find((category) => /travel|патув/i.test(category.name));
    setEnabled(group.me.syncEnabled);
    setCategoryId(group.me.syncCategoryId ?? travel?.id ?? choices[0]?.id ?? '');
    setPaymentMethodId(group.me.syncPaymentMethodId ?? paymentMethods?.[0]?.id ?? '');
    setKeepRecords('keep');
  }, [open, group.me, categories, paymentMethods]);

  const turningOff = group.me.syncEnabled && !enabled;

  const save = async () => {
    try {
      if (enabled) {
        if (!categoryId || !paymentMethodId) {
          toast.error(t('GROUP_SYNC_PICK_BOTH'));
          return;
        }
        await updateMe.mutateAsync({ groupId: group.id, data: { sync: { enabled: true, categoryId, paymentMethodId } } });
        toast.success(t('GROUP_SYNC_ON_DONE'));
      } else if (turningOff) {
        await updateMe.mutateAsync({ groupId: group.id, data: { sync: { enabled: false, keepRecords: keepRecords === 'keep' } } });
        toast.success(keepRecords === 'keep' ? t('GROUP_SYNC_OFF_KEPT') : t('GROUP_SYNC_OFF_REMOVED'));
      }
      onClose();
    } catch (error) {
      toast.error(groupErrorMessage(error, t, 'GROUP_SYNC_ERROR'));
    }
  };

  const example = {
    total: formatCurrencyAmount(EXAMPLE_TOTAL, group.baseCurrency),
    share: formatCurrencyAmount(EXAMPLE_TOTAL / EXAMPLE_PEOPLE, group.baseCurrency),
  };

  return (
    <AppDialog open={open} onClose={() => !updateMe.isPending && onClose()} maxWidth="sm" fullWidth fullScreen={isMobile} id="group-sync-dialog">
      <DialogTitle>{t('GROUP_SYNC_TITLE')}</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 1 }}>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(event) => setEnabled(event.target.checked)} color="secondary" />}
            label={t('GROUP_SYNC_SWITCH')}
          />
          {group.me.syncEnabled && (
            <Typography variant="body2" color="text.secondary">{t('GROUP_SYNC_COUNT', { count: group.me.syncedRecordCount })}</Typography>
          )}
          {!group.me.syncEnabled && group.me.keptRecordCount > 0 && (
            <Typography variant="body2" color="text.secondary">{t('GROUP_SYNC_KEPT_COUNT', { count: group.me.keptRecordCount })}</Typography>
          )}
          {enabled && (
            <>
              <TextField
                select
                label={t('GROUP_SYNC_CATEGORY')}
                value={categoryId}
                onChange={(event) => setCategoryId(Number(event.target.value))}
                helperText={expenseCategories.length === 0 ? t('GROUP_SYNC_NO_CATEGORY') : t('GROUP_SYNC_CATEGORY_HINT')}
                fullWidth
              >
                {expenseCategories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('PAYMENT_METHOD')}
                value={paymentMethodId}
                onChange={(event) => setPaymentMethodId(Number(event.target.value))}
                fullWidth
              >
                {(paymentMethods ?? []).map((method) => (
                  <MenuItem key={method.id} value={method.id}>{method.name}</MenuItem>
                ))}
              </TextField>
            </>
          )}
          {turningOff && (
            <Alert severity="info" variant="outlined">
              <Typography variant="body2" sx={{ mb: 1 }}>{t('GROUP_SYNC_OFF_QUESTION', { count: group.me.syncedRecordCount })}</Typography>
              <RadioGroup value={keepRecords} onChange={(event) => setKeepRecords(event.target.value)}>
                <FormControlLabel value="keep" control={<Radio color="secondary" />} label={t('GROUP_SYNC_KEEP')} />
                <FormControlLabel value="remove" control={<Radio color="secondary" />} label={t('GROUP_SYNC_REMOVE')} />
              </RadioGroup>
            </Alert>
          )}
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
            <Typography variant="overline" color="text.secondary">{t('GROUP_SYNC_HOW')}</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>{t('GROUP_SYNC_EXAMPLE', example)}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('GROUP_SYNC_NOT_SPENDING')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('GROUP_SYNC_LOCKED_FIELDS')}</Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button onClick={onClose} disabled={updateMe.isPending}>{t('CANCEL')}</Button>
        <Button variant="contained" onClick={save} disabled={updateMe.isPending}>
          {updateMe.isPending ? <CircularProgress size={24} /> : t('GROUP_SAVE')}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}

export default GroupSyncDialog;
