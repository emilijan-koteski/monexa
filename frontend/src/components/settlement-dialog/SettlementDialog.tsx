import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { Group } from '../../types/groups';
import { Currency } from '../../enums/Currency';
import { useCreateSettlement } from '../../services/groupExpenseService';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatAmount } from '../../utils/amount';
import { fromCents, newClientId, parseAmountCents, toApiDay } from '../../utils/groups';
import { groupErrorMessage } from '../../utils/groupErrors';
import AmountField from '../amount-field/AmountField';
import MemberChips from '../member-chips/MemberChips';

export interface SettlementPreset {
  fromMemberId: number;
  toMemberId: number;
  amount?: number;
}

interface SettlementDialogProps {
  open: boolean;
  onClose: () => void;
  group: Group;
  preset?: SettlementPreset | null;
}

function SettlementDialog({ open, onClose, group, preset }: SettlementDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const createSettlement = useCreateSettlement();
  const members = group.members;
  const meId = group.me.memberId;
  const [clientId, setClientId] = useState(newClientId());
  const [from, setFrom] = useState(meId);
  const [to, setTo] = useState(meId);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(group.baseCurrency);
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    const other = members.find((member) => member.id !== meId)?.id ?? meId;
    setClientId(newClientId());
    setFrom(preset?.fromMemberId ?? other);
    setTo(preset?.toMemberId ?? meId);
    setAmount(preset?.amount ? formatAmount(preset.amount.toFixed(2).replace(/\.00$/, '')) : '');
    setCurrency(group.baseCurrency);
    setDate(new Date());
    setNote('');
  }, [open, preset, members, meId, group.baseCurrency]);

  const cents = parseAmountCents(amount);
  const name = (id: number, lower = false) => {
    const member = members.find((m) => m.id === id);
    if (!member) {
      return '?';
    }
    if (member.isMe) {
      return lower ? t('GROUP_YOU_LOWER') : t('GROUP_YOU');
    }
    return member.displayName;
  };

  const save = async () => {
    if (from === to) {
      toast.error(t('GROUP_PAYMENT_SAME_PERSON'));
      return;
    }
    if (!cents) {
      toast.error(t('GROUP_PAYMENT_AMOUNT_REQUIRED'));
      return;
    }
    try {
      await createSettlement.mutateAsync({
        groupId: group.id,
        data: { clientId, fromMemberId: from, toMemberId: to, amount: fromCents(cents), currency, date: toApiDay(date), note: note.trim() || undefined },
      });
      toast.success(t('GROUP_PAYMENT_RECORDED'));
      onClose();
    } catch (error) {
      toast.error(groupErrorMessage(error, t, 'GROUP_PAYMENT_ERROR'));
    }
  };

  return (
    <Dialog open={open} onClose={() => !createSettlement.isPending && onClose()} maxWidth="sm" fullWidth fullScreen={isMobile} id="settlement-dialog">
      <DialogTitle>{t('GROUP_RECORD_PAYMENT')}</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 1 }}>
          <Box>
            <Typography variant="overline" color="text.secondary">{t('GROUP_WHO_PAID')}</Typography>
            <MemberChips members={members} selected={[from]} onToggle={setFrom} />
          </Box>
          <Box>
            <Typography variant="overline" color="text.secondary">{t('GROUP_PAID_TO')}</Typography>
            <MemberChips members={members} selected={[to]} onToggle={setTo} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <AmountField value={amount} onChange={setAmount} label={t('AMOUNT')} fullWidth autoFocus />
            <TextField select value={currency} onChange={(event) => setCurrency(event.target.value)} label={t('CURRENCY')} sx={{ minWidth: 110 }}>
              {Object.values(Currency).map((code) => (
                <MenuItem key={code} value={code}>{code}</MenuItem>
              ))}
            </TextField>
          </Box>
          <DatePicker label={t('DATE')} value={date} onChange={(value) => value && setDate(value)} slotProps={{ textField: { fullWidth: true } }} />
          <TextField value={note} onChange={(event) => setNote(event.target.value)} label={t('GROUP_NOTE')} fullWidth />
          <Typography variant="body2" color="text.secondary">{t('GROUP_PAYMENT_HINT')}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions className="dialog-actions" sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
        {cents ? (
          <Typography variant="body2">
            {from === meId
              ? t('GROUP_YOU_PAID_SUMMARY', { to: name(to), amount: formatCurrencyAmount(fromCents(cents), currency) })
              : to === meId
                ? t('GROUP_PAID_YOU_SUMMARY', { from: name(from), amount: formatCurrencyAmount(fromCents(cents), currency) })
                : t('GROUP_PAYMENT_SUMMARY', { from: name(from), to: name(to), amount: formatCurrencyAmount(fromCents(cents), currency) })}
          </Typography>
        ) : null}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onClose} disabled={createSettlement.isPending}>{t('CANCEL')}</Button>
          <Button variant="contained" onClick={save} disabled={createSettlement.isPending}>
            {createSettlement.isPending ? <CircularProgress size={24} /> : t('GROUP_SAVE_PAYMENT')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default SettlementDialog;
