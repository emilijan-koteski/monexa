import './group-expense-item.scss';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import type { GroupExpense, GroupMember } from '../../types/groups';
import { formatCurrencyAmount } from '../../utils/currency';
import { CATEGORY_META } from '../../utils/groups';

interface GroupExpenseItemProps {
  expense: GroupExpense;
  members: Map<number, GroupMember>;
  meId: number;
  baseCurrency: string;
  onOpen: (expense: GroupExpense) => void;
}

type Status = 'lent' | 'borrowed' | 'none' | 'pending' | 'self';

function GroupExpenseItem({ expense, members, meId, baseCurrency, onOpen }: GroupExpenseItemProps) {
  const { t } = useTranslation();
  const meta = CATEGORY_META[expense.category];
  const name = (id: number | null) => {
    const member = id != null ? members.get(id) : undefined;
    if (!member) {
      return '?';
    }
    return member.isMe ? t('GROUP_YOU') : member.displayName;
  };
  const lower = (id: number | null) => (id === meId ? t('GROUP_YOU_LOWER') : name(id));

  const myShare = expense.shares.find((share) => share.memberId === meId)?.baseAmount ?? 0;
  let status: Status;
  let amountText: string;
  if (expense.pending) {
    status = 'pending';
    amountText = '?';
  } else if (expense.paidByMemberId === meId) {
    const lent = (expense.baseAmount ?? 0) - myShare;
    status = lent > 0.004 ? 'lent' : 'self';
    amountText = lent > 0.004 ? `+${formatCurrencyAmount(lent, baseCurrency)}` : formatCurrencyAmount(expense.baseAmount ?? 0, baseCurrency);
  } else if (expense.shares.some((share) => share.memberId === meId)) {
    status = 'borrowed';
    amountText = `-${formatCurrencyAmount(myShare, baseCurrency)}`;
  } else {
    status = 'none';
    amountText = formatCurrencyAmount(expense.baseAmount ?? 0, baseCurrency);
  }

  const everyone = members.size > 0 && Array.from(members.keys()).every((id) => expense.shares.some((share) => share.memberId === id));
  const forNames = expense.shares.map((share) => lower(share.memberId));
  const forText = everyone
    ? t('GROUP_FOR_EVERYONE')
    : forNames.length <= 1 ? forNames.join('') : `${forNames.slice(0, -1).join(', ')} ${t('GROUP_AND')} ${forNames[forNames.length - 1]}`;
  const paid = expense.pending
    ? t('GROUP_PAID_UNKNOWN', { name: name(expense.paidByMemberId) })
    : t('GROUP_PAID_AMOUNT', {
      name: name(expense.paidByMemberId),
      amount: formatCurrencyAmount(expense.amount ?? 0, expense.currency)
        + (expense.currency !== baseCurrency ? ` (${formatCurrencyAmount(expense.baseAmount ?? 0, baseCurrency)})` : ''),
    });
  const byline = expense.updatedByMemberId
    ? t('GROUP_ADDED_EDITED_BY', { added: lower(expense.createdByMemberId), edited: lower(expense.updatedByMemberId) })
    : t('GROUP_ADDED_BY', { name: lower(expense.createdByMemberId) });

  return (
    <ButtonBase className={`group-expense-item ${status}`} onClick={() => onOpen(expense)}>
      <Box className="expense-icon" sx={{ color: meta.color, backgroundColor: alpha(meta.color, 0.18) }}>
        <FontAwesomeIcon icon={meta.icon} />
      </Box>
      <Box className="expense-text">
        <Typography className="expense-title">{expense.title}</Typography>
        <Typography className="expense-caption">{paid} · {forText}</Typography>
        <Typography className="expense-byline">{byline}</Typography>
      </Box>
      <Box className="expense-amount">
        <Typography className="expense-status">{t(`GROUP_STATUS_${status.toUpperCase()}`)}</Typography>
        <Typography className="expense-value">{amountText}</Typography>
      </Box>
    </ButtonBase>
  );
}

export default GroupExpenseItem;
