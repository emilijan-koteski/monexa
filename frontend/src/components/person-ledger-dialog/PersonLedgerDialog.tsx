import './person-ledger-dialog.scss';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { Group, GroupExpense, GroupExpenseShare, GroupSettlement } from '../../types/groups';
import { useCreateSettlement } from '../../services/groupExpenseService';
import { formatCurrencyAmount } from '../../utils/currency';
import { dateLocale, fromApiDay } from '../../utils/groups';
import { groupErrorMessage } from '../../utils/groupErrors';
import MemberAvatar from '../member-avatar/MemberAvatar';
import type { SettlementPreset } from '../settlement-dialog/SettlementDialog';

interface PersonLedgerDialogProps {
  open: boolean;
  onClose: () => void;
  group: Group;
  memberId: number | null;
  expenses: GroupExpense[];
  settlements: GroupSettlement[];
  pairAmount: number;
  onFillAmount: (expense: GroupExpense) => void;
  onRecordPayment: (preset: SettlementPreset) => void;
  onUntick: (expense: GroupExpense, share: GroupExpenseShare) => void;
  onRemovePayment: (settlement: GroupSettlement) => void;
}

interface LedgerItem {
  expense: GroupExpense;
  share: GroupExpenseShare;
}

function PersonLedgerDialog({
  open,
  onClose,
  group,
  memberId,
  expenses,
  settlements,
  pairAmount,
  onFillAmount,
  onRecordPayment,
  onUntick,
  onRemovePayment,
}: PersonLedgerDialogProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const createSettlement = useCreateSettlement();
  const meId = group.me.memberId;
  const member = group.members.find((m) => m.id === memberId);
  const me = group.members.find((m) => m.id === meId);
  if (!member || !me) {
    return null;
  }
  const locale = dateLocale(i18n.language);
  const day = (value: string) => format(fromApiDay(value), 'EEE d MMM', { locale });
  const items = (debtorId: number, creditorId: number): LedgerItem[] =>
    expenses
      .filter((expense) => expense.paidByMemberId === creditorId)
      .flatMap((expense) => expense.shares.filter((share) => share.memberId === debtorId).map((share) => ({ expense, share })));
  const theyOwe = items(member.id, meId);
  const iOwe = items(meId, member.id);
  const payments = settlements.filter(
    (s) => (s.fromMemberId === member.id && s.toMemberId === meId) || (s.fromMemberId === meId && s.toMemberId === member.id),
  );
  const currency = group.baseCurrency;
  const archived = !!group.archivedAt;

  const tick = async (item: LedgerItem) => {
    if (item.share.tickSettlementId) {
      onUntick(item.expense, item.share);
      return;
    }
    try {
      await createSettlement.mutateAsync({ groupId: group.id, data: { shareId: item.share.id } });
      toast.success(t('GROUP_TICKED', { amount: formatCurrencyAmount(item.share.baseAmount ?? 0, currency) }));
    } catch (error) {
      toast.error(groupErrorMessage(error, t, 'GROUP_ERROR_TICK'));
    }
  };

  const renderItems = (list: LedgerItem[]) =>
    list.length === 0 ? (
      <Typography className="ledger-nothing">{t('GROUP_LEDGER_NOTHING')}</Typography>
    ) : (
      list.map((item) => {
        const ticked = !!item.share.tickSettlementId;
        return (
          <Box key={item.share.id} className={`ledger-item ${ticked ? 'ticked' : ''}`}>
            {item.expense.pending ? (
              <Box className="ledger-pending-icon"><FontAwesomeIcon icon={faTriangleExclamation} /></Box>
            ) : (
              <Checkbox
                checked={ticked}
                onChange={() => tick(item)}
                disabled={archived || createSettlement.isPending}
                color="secondary"
                slotProps={{ input: { 'aria-label': ticked ? t('GROUP_UNTICK_ITEM', { title: item.expense.title }) : t('GROUP_TICK_ITEM', { title: item.expense.title }) } }}
              />
            )}
            <Box className="ledger-text">
              <Typography className="ledger-title">{item.expense.title}</Typography>
              <Typography className="ledger-date">{day(item.expense.date)}</Typography>
            </Box>
            {item.expense.pending ? (
              <Button size="small" variant="outlined" color="warning" onClick={() => onFillAmount(item.expense)} disabled={archived}>
                {t('GROUP_ADD_AMOUNT')}
              </Button>
            ) : (
              <Typography className="ledger-amount">{formatCurrencyAmount(item.share.baseAmount ?? 0, currency)}</Typography>
            )}
          </Box>
        );
      })
    );

  const name = member.displayName;
  const netClass = pairAmount > 0 ? 'owed' : pairAmount < 0 ? 'owe' : 'settled';
  const netText = pairAmount > 0
    ? t('GROUP_PAIR_OWES_YOU', { name, amount: formatCurrencyAmount(pairAmount, currency) })
    : pairAmount < 0
      ? t('GROUP_PAIR_YOU_OWE', { name, amount: formatCurrencyAmount(-pairAmount, currency) })
      : t('GROUP_PAIR_SQUARE', { name });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile} id="person-ledger-dialog">
      <DialogTitle className="ledger-title-bar">
        <Box className="ledger-avatars">
          <MemberAvatar member={me} size={30} />
          <MemberAvatar member={member} size={30} />
        </Box>
        {t('GROUP_LEDGER_TITLE', { name })}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2.5}>
          <Box className="ledger-net">
            <Typography className={`ledger-net-amount ${netClass}`}>{netText}</Typography>
            <Typography variant="caption" className="ledger-muted">{t('GROUP_LEDGER_HINT')}</Typography>
          </Box>
          <Stack gap={1}>
            <Typography variant="overline" className="ledger-muted">{t('GROUP_LEDGER_THEY_OWE', { name })}</Typography>
            {renderItems(theyOwe)}
          </Stack>
          <Stack gap={1}>
            <Typography variant="overline" className="ledger-muted">{t('GROUP_LEDGER_YOU_OWE', { name })}</Typography>
            {renderItems(iOwe)}
          </Stack>
          {payments.length > 0 && (
            <Stack gap={1}>
              <Typography variant="overline" className="ledger-muted">{t('GROUP_PAYMENTS')}</Typography>
              {payments.map((payment) => (
                <Box key={payment.id} className="ledger-payment">
                  <Box className="ledger-text">
                    <Typography>
                      {payment.fromMemberId === meId
                        ? t('GROUP_YOU_PAID_LINE', { to: name, amount: formatCurrencyAmount(payment.baseAmount, currency) })
                        : t('GROUP_PAID_YOU_LINE', { from: name, amount: formatCurrencyAmount(payment.baseAmount, currency) })}
                    </Typography>
                    <Typography className="ledger-date">
                      {day(payment.date)}{payment.note ? ` · ${payment.note}` : ''}
                    </Typography>
                  </Box>
                  {!archived && <Button size="small" onClick={() => onRemovePayment(payment)}>{t('GROUP_REMOVE')}</Button>}
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button onClick={onClose}>{t('GROUP_CLOSE')}</Button>
        {pairAmount !== 0 && !archived && (
          <Button
            variant="contained"
            onClick={() => onRecordPayment(pairAmount > 0
              ? { fromMemberId: member.id, toMemberId: meId, amount: pairAmount }
              : { fromMemberId: meId, toMemberId: member.id, amount: -pairAmount })}
          >
            {t('GROUP_RECORD_PAYMENT_REST')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default PersonLedgerDialog;
