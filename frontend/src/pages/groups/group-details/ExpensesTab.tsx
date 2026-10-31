import { Chip, Stack, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Group, GroupExpense, GroupMember } from '../../../types/groups';
import { dateLocale, fromApiDay } from '../../../utils/groups';
import GroupExpenseItem from '../../../components/group-expense-item/GroupExpenseItem';
import EmptyState from '../../../components/empty-state/EmptyState';

export type ExpenseFilter = 'all' | 'missing' | 'mine';

interface ExpensesTabProps {
  group: Group;
  expenses: GroupExpense[];
  members: Map<number, GroupMember>;
  filter: ExpenseFilter;
  onFilterChange: (filter: ExpenseFilter) => void;
  onOpen: (expense: GroupExpense) => void;
}

function ExpensesTab({ group, expenses, members, filter, onFilterChange, onOpen }: ExpensesTabProps) {
  const { t, i18n } = useTranslation();
  const meId = group.me.memberId;
  const involvesMe = (expense: GroupExpense) =>
    expense.paidByMemberId === meId || expense.shares.some((share) => share.memberId === meId);
  const missingCount = expenses.filter((expense) => expense.pending).length;
  const visible = expenses.filter((expense) => (filter === 'missing' ? expense.pending : filter === 'mine' ? involvesMe(expense) : true));

  const days = new Map<string, GroupExpense[]>();
  visible.forEach((expense) => {
    const key = expense.date.slice(0, 10);
    days.set(key, [...(days.get(key) ?? []), expense]);
  });
  const locale = dateLocale(i18n.language);

  const filters: { key: ExpenseFilter; label: string }[] = [
    { key: 'all', label: `${t('GROUP_FILTER_ALL')} · ${expenses.length}` },
    { key: 'missing', label: `${t('GROUP_FILTER_MISSING')} · ${missingCount}` },
    { key: 'mine', label: t('GROUP_FILTER_MINE') },
  ];

  return (
    <Stack gap={2} className="expenses-tab">
      <Stack direction="row" gap={1} className="filter-row">
        {filters.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            onClick={() => onFilterChange(item.key)}
            color={filter === item.key ? 'secondary' : 'default'}
            variant={filter === item.key ? 'filled' : 'outlined'}
            aria-pressed={filter === item.key}
          />
        ))}
      </Stack>
      {expenses.length === 0 ? (
        <EmptyState title={t('GROUP_NO_EXPENSES_TITLE')} message={t('GROUP_NO_EXPENSES_MESSAGE')} />
      ) : visible.length === 0 ? (
        <EmptyState title={filter === 'missing' ? t('GROUP_NO_MISSING_TITLE') : t('GROUP_NOTHING_HERE')} />
      ) : (
        Array.from(days.entries()).map(([day, items]) => (
          <Stack key={day} gap={1}>
            <Typography variant="overline" className="day-label">{format(fromApiDay(day), 'EEE, d MMM', { locale })}</Typography>
            {items.map((expense) => (
              <GroupExpenseItem key={expense.id} expense={expense} members={members} meId={meId} baseCurrency={group.baseCurrency} onOpen={onOpen} />
            ))}
          </Stack>
        ))
      )}
    </Stack>
  );
}

export default ExpensesTab;
