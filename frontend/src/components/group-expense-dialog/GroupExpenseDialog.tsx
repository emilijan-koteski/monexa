import './group-expense-dialog.scss';
import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTrash, faTriangleExclamation, faUsers } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import type { Group, GroupExpense, GroupExpenseRequest } from '../../types/groups';
import { Currency } from '../../enums/Currency';
import { GroupExpenseCategory } from '../../enums/GroupExpenseCategory';
import { SplitType } from '../../enums/SplitType';
import { useCreateGroupExpense, useRateQuote, useUpdateGroupExpense } from '../../services/groupExpenseService';
import { groupQueryKeys, isGroupError } from '../../services/groupService';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatAmount } from '../../utils/amount';
import {
  allocateCents,
  CATEGORY_META,
  fromApiDay,
  fromCents,
  GROUP_CATEGORIES,
  guessCategory,
  newClientId,
  parseAmountCents,
  readLastCurrency,
  rememberCurrency,
  toApiDay,
} from '../../utils/groups';
import { groupErrorMessage } from '../../utils/groupErrors';
import AmountField from '../amount-field/AmountField';
import MemberChips from '../member-chips/MemberChips';
import MemberAvatar from '../member-avatar/MemberAvatar';

interface GroupExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  group: Group;
  expenses: GroupExpense[];
  expense?: GroupExpense | null;
  fillAmount?: boolean;
  onDelete?: (expense: GroupExpense) => void;
}

interface SplitRow {
  memberId: number;
  cents: number | null;
  typed: boolean;
}

type Tone = 'good' | 'bad' | 'muted';

const CONFLICT = 409;

function clampToTrip(group: Group, day: Date): Date {
  const start = group.startDate ? fromApiDay(group.startDate) : null;
  const end = group.endDate ? fromApiDay(group.endDate) : null;
  if (start && day < start) {
    return start;
  }
  if (end && day > end) {
    return end;
  }
  return day;
}

const centsToInput = (cents: number) => formatAmount(fromCents(cents).toFixed(2).replace(/\.00$/, ''));

function GroupExpenseDialog({ open, onClose, group, expenses, expense, fillAmount = false, onDelete }: GroupExpenseDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const createExpense = useCreateGroupExpense();
  const updateExpense = useUpdateGroupExpense();
  const isSaving = createExpense.isPending || updateExpense.isPending;
  const members = group.members;
  const meId = group.me.memberId;

  const [clientId, setClientId] = useState(newClientId());
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(group.baseCurrency);
  const [pending, setPending] = useState(false);
  const [manualRate, setManualRate] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GroupExpenseCategory>(GroupExpenseCategory.OTHER);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [payer, setPayer] = useState(meId);
  const [selected, setSelected] = useState<number[]>([]);
  const [mode, setMode] = useState<SplitType>(SplitType.EQUAL);
  const [exactValues, setExactValues] = useState<Record<number, string>>({});
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setClientId(newClientId());
    if (expense) {
      setAmount(expense.amount != null ? centsToInput(Math.round(expense.amount * 100)) : '');
      setCurrency(expense.currency);
      setPending(fillAmount ? false : expense.pending);
      setManualRate(expense.rateIsManual ? String(expense.exchangeRate) : null);
      setTitle(expense.title);
      setCategory(expense.category);
      setCategoryTouched(true);
      setPayer(expense.paidByMemberId);
      setSelected(expense.shares.map((share) => share.memberId));
      setMode(expense.splitType);
      setExactValues(expense.splitType === SplitType.EXACT
        ? Object.fromEntries(expense.shares.map((share) => [share.memberId, share.amount != null ? centsToInput(Math.round(share.amount * 100)) : '']))
        : {});
      setDate(fromApiDay(expense.date));
      setNote(expense.note ?? '');
      return;
    }
    setAmount('');
    setCurrency(readLastCurrency(group.id) ?? group.baseCurrency);
    setPending(false);
    setManualRate(null);
    setTitle('');
    setCategory(GroupExpenseCategory.OTHER);
    setCategoryTouched(false);
    setPayer(meId);
    setSelected(members.map((member) => member.id));
    setMode(SplitType.EQUAL);
    setExactValues({});
    setDate(clampToTrip(group, new Date()));
    setNote('');
  }, [open, expense, fillAmount, group, members, meId]);

  const titleSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return expenses
      .map((item) => item.title)
      .filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 20);
  }, [expenses]);

  const foreign = currency !== group.baseCurrency;
  const day = toApiDay(date);
  const { data: quote } = useRateQuote(currency, group.baseCurrency, day, open && foreign && manualRate === null);
  const effectiveRate = manualRate !== null ? Number(manualRate) : foreign ? quote?.rate : 1;

  const totalCents = pending ? null : parseAmountCents(amount);
  const total = totalCents && totalCents > 0 ? totalCents : null;
  const sortedSelected = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const exactMode = !pending && mode === SplitType.EXACT;

  const split = useMemo(() => {
    let rows: SplitRow[];
    let ok = false;
    let text = '';
    let tone: Tone = 'muted';
    if (!exactMode) {
      const parts = total ? allocateCents(total, sortedSelected.map(() => 1)) : sortedSelected.map(() => null);
      rows = sortedSelected.map((memberId, i) => ({ memberId, cents: parts[i], typed: false }));
      if (!sortedSelected.length) {
        text = t('GROUP_SPLIT_PICK_SOMEONE');
        tone = 'bad';
      } else if (pending) {
        ok = true;
        text = t('GROUP_SPLIT_PENDING');
      } else if (!total) {
        text = t('GROUP_SPLIT_ENTER_TOTAL');
      } else {
        ok = true;
        text = t('GROUP_SPLIT_ADDS_UP', { amount: formatCurrencyAmount(fromCents(total), currency) });
        tone = 'good';
      }
      return { rows, ok, text, tone };
    }
    const typed = sortedSelected.map((memberId) => (exactValues[memberId] ? parseAmountCents(exactValues[memberId]) : null));
    const typedSum = typed.reduce<number>((acc, value) => acc + (value ?? 0), 0);
    const blanks = sortedSelected.filter((_, i) => typed[i] === null);
    const rest = (total ?? 0) - typedSum;
    const auto = blanks.length && rest > 0 ? allocateCents(rest, blanks.map(() => 1)) : blanks.map(() => 0);
    rows = sortedSelected.map((memberId, i) => (typed[i] !== null
      ? { memberId, cents: typed[i], typed: true }
      : { memberId, cents: total ? auto[blanks.indexOf(memberId)] : null, typed: false }));
    if (!sortedSelected.length) {
      text = t('GROUP_SPLIT_PICK_SOMEONE');
      tone = 'bad';
    } else if (!total) {
      text = t('GROUP_SPLIT_ENTER_TOTAL');
    } else if (rest < 0) {
      text = t('GROUP_SPLIT_TOO_MUCH', { amount: formatCurrencyAmount(fromCents(-rest), currency) });
      tone = 'bad';
    } else if (!blanks.length && rest > 0) {
      text = t('GROUP_SPLIT_LEFT', { amount: formatCurrencyAmount(fromCents(rest), currency) });
      tone = 'bad';
    } else {
      ok = true;
      text = t('GROUP_SPLIT_ADDS_UP', { amount: formatCurrencyAmount(fromCents(total), currency) });
      tone = 'good';
    }
    return { rows, ok, text, tone };
  }, [exactMode, total, sortedSelected, exactValues, pending, currency, t]);

  const memberName = (memberId: number) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) {
      return '?';
    }
    return member.isMe ? t('GROUP_YOU') : member.displayName;
  };
  const joinNames = (names: string[]) =>
    names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ${t('GROUP_AND')} ${names[names.length - 1]}`;

  const summary = (() => {
    if (pending) {
      return t('GROUP_SUMMARY_PENDING');
    }
    if (!total || !split.ok) {
      return '';
    }
    const debtors = split.rows.filter((row) => row.memberId !== payer && (row.cents ?? 0) > 0);
    if (!debtors.length) {
      return t('GROUP_SUMMARY_NOBODY');
    }
    const sum = (rows: SplitRow[]) => formatCurrencyAmount(fromCents(rows.reduce((acc, row) => acc + (row.cents ?? 0), 0)), currency);
    if (payer === meId) {
      return t('GROUP_SUMMARY_OWE_YOU', { count: debtors.length, names: joinNames(debtors.map((row) => memberName(row.memberId))), amount: sum(debtors) });
    }
    const mine = debtors.filter((row) => row.memberId === meId);
    const others = debtors.filter((row) => row.memberId !== meId);
    const parts: string[] = [];
    if (mine.length) {
      parts.push(t('GROUP_SUMMARY_YOU_OWE', { name: memberName(payer), amount: sum(mine) }));
    }
    if (others.length) {
      parts.push(t('GROUP_SUMMARY_OTHERS_OWE', { count: others.length, names: joinNames(others.map((row) => memberName(row.memberId))), name: memberName(payer), amount: sum(others) }));
    }
    return parts.join(' ');
  })();

  const everyoneSelected = members.every((member) => selected.includes(member.id));
  const toggleMember = (memberId: number) =>
    setSelected((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  const toggleEveryone = () => setSelected(everyoneSelected ? [] : members.map((member) => member.id));

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (!categoryTouched) {
      setCategory(guessCategory(value) ?? GroupExpenseCategory.OTHER);
    }
  };

  const onModeChange = (next: SplitType | null) => {
    if (!next || (next === SplitType.EXACT && pending)) {
      return;
    }
    if (next === SplitType.EXACT && mode !== SplitType.EXACT) {
      setExactValues({});
    }
    setMode(next);
  };

  const togglePending = () => {
    setPending((value) => {
      if (!value) {
        setMode(SplitType.EQUAL);
      }
      return !value;
    });
  };

  const rateLabel = () => {
    if (!foreign) {
      return null;
    }
    if (manualRate !== null) {
      return t('GROUP_RATE_MANUAL_LABEL', { from: currency, to: group.baseCurrency });
    }
    if (!quote) {
      return t('GROUP_RATE_LOADING');
    }
    return t('GROUP_RATE_LINE', { from: currency, rate: quote.rate.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''), to: group.baseCurrency });
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error(t('GROUP_TITLE_REQUIRED'));
      return;
    }
    if (!pending && !total) {
      toast.error(t('GROUP_SPLIT_ENTER_TOTAL_OR_PENDING'));
      return;
    }
    if (!split.ok) {
      toast.error(split.text);
      return;
    }
    if (manualRate !== null && !(Number(manualRate) > 0)) {
      toast.error(t('GROUP_RATE_INVALID'));
      return;
    }
    const shares = exactMode
      ? split.rows.filter((row) => (row.cents ?? 0) > 0).map((row) => ({ memberId: row.memberId, amount: fromCents(row.cents ?? 0) }))
      : sortedSelected.map((memberId) => ({ memberId }));
    const payload: GroupExpenseRequest = {
      title: title.trim(),
      pending,
      amount: pending || !total ? undefined : fromCents(total),
      currency,
      exchangeRate: foreign && manualRate !== null ? Number(manualRate) : undefined,
      date: day,
      category,
      splitType: exactMode ? SplitType.EXACT : SplitType.EQUAL,
      paidByMemberId: payer,
      shares,
      note: note.trim() || undefined,
    };
    try {
      if (expense) {
        const result = await updateExpense.mutateAsync({ groupId: group.id, expenseId: expense.id, data: { ...payload, version: expense.version } });
        toast.success(result.detachedTicks > 0 ? t('GROUP_TICKS_DETACHED', { count: result.detachedTicks }) : t('GROUP_EXPENSE_UPDATED'));
      } else {
        await createExpense.mutateAsync({ groupId: group.id, data: { ...payload, clientId } });
        toast.success(t('GROUP_EXPENSE_ADDED'));
      }
      rememberCurrency(group.id, currency);
      onClose();
    } catch (error) {
      if (isGroupError(error, CONFLICT) && expense) {
        queryClient.invalidateQueries({ queryKey: groupQueryKeys.detail(group.id) });
      }
      toast.error(groupErrorMessage(error, t, 'GROUP_EXPENSE_SAVE_ERROR'));
    }
  };

  return (
    <Dialog open={open} onClose={() => !isSaving && onClose()} id="group-expense-dialog" maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle className="expense-dialog-title">
        <span>{expense ? t('GROUP_EDIT_EXPENSE') : t('GROUP_NEW_EXPENSE')}</span>
        {expense && onDelete && (
          <Tooltip title={t('GROUP_DELETE_EXPENSE')}>
            <IconButton color="error" aria-label={t('GROUP_DELETE_EXPENSE')} onClick={() => onDelete(expense)}>
              <FontAwesomeIcon icon={faTrash} />
            </IconButton>
          </Tooltip>
        )}
      </DialogTitle>
      <DialogContent>
        <Box className="expense-form">
          <Box className="section">
            <Box className="amount-row">
              <AmountField
                value={amount}
                onChange={setAmount}
                label={t('GROUP_TOTAL_BILL')}
                disabled={pending}
                className="amount-input"
                autoFocus={!expense || fillAmount}
                fullWidth
              />
              <TextField select value={currency} onChange={(event) => setCurrency(event.target.value)} label={t('CURRENCY')} className="currency-input">
                {Object.values(Currency).map((code) => (
                  <MenuItem key={code} value={code}>{code}</MenuItem>
                ))}
              </TextField>
            </Box>
            {foreign && (
              <Box className="rate-box">
                <Typography variant="body2" className={`rate-line ${quote?.source === 'FALLBACK' && manualRate === null ? 'approximate' : ''}`}>
                  {quote?.source === 'FALLBACK' && manualRate === null && <FontAwesomeIcon icon={faTriangleExclamation} />}
                  {rateLabel()}
                  {quote?.source === 'FALLBACK' && manualRate === null && ` · ${t('GROUP_RATE_APPROXIMATE')}`}
                </Typography>
                {manualRate !== null ? (
                  <Box className="manual-rate-row">
                    <TextField
                      size="small"
                      value={manualRate}
                      onChange={(event) => setManualRate(event.target.value.replace(/[^0-9.]/g, ''))}
                      label={t('GROUP_RATE_FIELD', { from: currency, to: group.baseCurrency })}
                      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                    />
                    <Button size="small" onClick={() => setManualRate(null)}>{t('GROUP_RATE_RESET')}</Button>
                  </Box>
                ) : (
                  <Button size="small" onClick={() => setManualRate(quote ? String(quote.rate) : '')}>{t('GROUP_RATE_EDIT')}</Button>
                )}
                {total && effectiveRate ? (
                  <Typography variant="body2" className="converted">
                    {t('GROUP_CONVERTED', { amount: formatCurrencyAmount(fromCents(Math.round(total * effectiveRate)), group.baseCurrency) })}
                  </Typography>
                ) : null}
              </Box>
            )}
            <FormControlLabel
              control={<Checkbox checked={pending} onChange={togglePending} color="secondary" />}
              label={t('GROUP_AMOUNT_UNKNOWN')}
              className="pending-toggle"
            />
          </Box>

          <Box className="section">
            <Autocomplete
              freeSolo
              options={titleSuggestions}
              inputValue={title}
              onInputChange={(_, value) => onTitleChange(value)}
              renderInput={(params) => <TextField {...params} label={t('GROUP_WHAT_FOR')} placeholder={t('GROUP_WHAT_FOR_PLACEHOLDER')} />}
            />
            <Box className="category-chips" role="radiogroup" aria-label={t('GROUP_CATEGORY')}>
              {GROUP_CATEGORIES.map((value) => {
                const meta = CATEGORY_META[value];
                const active = category === value;
                return (
                  <Chip
                    key={value}
                    role="radio"
                    aria-checked={active}
                    icon={<FontAwesomeIcon icon={meta.icon} style={{ color: active ? undefined : meta.color }} />}
                    label={t(meta.labelKey)}
                    onClick={() => {
                      setCategory(value);
                      setCategoryTouched(true);
                    }}
                    className={`category-chip ${active ? 'selected' : ''}`}
                  />
                );
              })}
            </Box>
          </Box>

          <Box className="section">
            <Typography variant="overline" className="section-label">{t('GROUP_PAID_BY')}</Typography>
            <MemberChips members={members} selected={[payer]} onToggle={setPayer} />
          </Box>

          <Box className="section">
            <Typography variant="overline" className="section-label">{t('GROUP_SPLIT_WITH')}</Typography>
            <Box className="split-with">
              <Chip
                icon={<FontAwesomeIcon icon={faUsers} />}
                label={t('GROUP_EVERYONE')}
                onClick={toggleEveryone}
                aria-pressed={everyoneSelected}
                className={`everyone-chip ${everyoneSelected ? 'selected' : ''}`}
              />
              <MemberChips members={members} selected={selected} onToggle={toggleMember} showCheck />
            </Box>
          </Box>

          <Box className="section">
            <Typography variant="overline" className="section-label">{t('GROUP_HOW_TO_SPLIT')}</Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={exactMode ? SplitType.EXACT : SplitType.EQUAL}
              onChange={(_, value) => onModeChange(value)}
              className="mode-toggle"
            >
              <ToggleButton value={SplitType.EQUAL}>{t('GROUP_SPLIT_EQUALLY')}</ToggleButton>
              <ToggleButton value={SplitType.EXACT} disabled={pending}>{t('GROUP_SPLIT_EXACT')}</ToggleButton>
            </ToggleButtonGroup>
            <Box className="split-rows">
              {split.rows.length === 0 && <Typography className="split-empty">{t('GROUP_SPLIT_NOBODY')}</Typography>}
              {split.rows.map((row) => {
                const member = members.find((m) => m.id === row.memberId);
                return (
                  <Box key={row.memberId} className="split-row">
                    {member && <MemberAvatar member={member} size={28} />}
                    <Typography className="split-name">{memberName(row.memberId)}</Typography>
                    {exactMode ? (
                      <AmountField
                        size="small"
                        value={exactValues[row.memberId] ?? ''}
                        onChange={(value) => setExactValues((current) => ({ ...current, [row.memberId]: value }))}
                        placeholder={row.cents != null ? formatAmount(fromCents(row.cents).toFixed(2)) : '0.00'}
                        className="split-input"
                        aria-label={t('GROUP_AMOUNT_FOR', { name: memberName(row.memberId) })}
                      />
                    ) : (
                      <Typography className="split-amount">
                        {row.cents != null ? formatCurrencyAmount(fromCents(row.cents), currency) : '—'}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
            <Typography className={`split-status ${split.tone}`}>
              {split.tone === 'good' && <FontAwesomeIcon icon={faCheck} />}
              {split.text}
            </Typography>
            {exactMode && <Typography variant="caption" className="split-hint">{t('GROUP_SPLIT_EXACT_HINT')}</Typography>}
          </Box>

          <Box className="section date-note">
            <DatePicker
              label={t('DATE')}
              value={date}
              onChange={(value) => value && setDate(value)}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <TextField value={note} onChange={(event) => setNote(event.target.value)} label={t('GROUP_NOTE')} fullWidth multiline maxRows={3} />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions className="dialog-actions expense-actions">
        {summary && <Typography className="expense-summary">{summary}</Typography>}
        <Box className="expense-buttons">
          <Button onClick={onClose} disabled={isSaving} className="cancel-button">{t('CANCEL')}</Button>
          <Button variant="contained" onClick={save} disabled={isSaving} className="submit-button">
            {isSaving ? <CircularProgress size={24} /> : t('GROUP_SAVE_EXPENSE')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default GroupExpenseDialog;
