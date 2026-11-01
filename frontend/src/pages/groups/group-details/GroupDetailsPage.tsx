import './group-details-page.scss';
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AppDialog from '../../../components/app-dialog/AppDialog';
import { alpha } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faBoxArchive,
  faEllipsisVertical,
  faPen,
  faPlus,
  faRightFromBracket,
  faSliders,
  faTrash,
  faTriangleExclamation,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { toast } from 'react-toastify';
import type { Group, GroupExpense, GroupExpenseShare, GroupMember, GroupSettlement } from '../../../types/groups';
import { GroupMemberRole } from '../../../enums/GroupMemberRole';
import {
  groupApi,
  groupQueryKeys,
  invalidateGroupData,
  isGroupError,
  useDeleteGroup,
  useGroup,
  useLeaveGroup,
  useUpdateGroup,
} from '../../../services/groupService';
import { groupExpenseApi, useGroupBalances, useGroupExpenses, useGroupSettlements } from '../../../services/groupExpenseService';
import { useUndoableAction } from '../../../hooks/useUndoableAction';
import { formatCurrencyAmount } from '../../../utils/currency';
import { formatDateRange, groupIcon } from '../../../utils/groups';
import { groupErrorMessage } from '../../../utils/groupErrors';
import GroupExpenseDialog from '../../../components/group-expense-dialog/GroupExpenseDialog';
import SettlementDialog, { type SettlementPreset } from '../../../components/settlement-dialog/SettlementDialog';
import PersonLedgerDialog from '../../../components/person-ledger-dialog/PersonLedgerDialog';
import GroupSyncDialog from '../../../components/group-sync-dialog/GroupSyncDialog';
import GroupDialog from '../../../components/group-dialog/GroupDialog';
import ConfirmationDialog from '../../../components/confirmation-dialog/ConfirmationDialog';
import EmptyState from '../../../components/empty-state/EmptyState';
import ExpensesTab, { type ExpenseFilter } from './ExpensesTab';
import BalancesTab from './BalancesTab';
import StatsTab from './StatsTab';
import PeopleTab from './PeopleTab';

const TABS = ['expenses', 'balances', 'stats', 'people'] as const;
type GroupTab = (typeof TABS)[number];
const FILTERS: ExpenseFilter[] = ['all', 'missing', 'mine'];
const NOT_FOUND = 404;

interface ExpenseDialogState {
  open: boolean;
  expense: GroupExpense | null;
  fillAmount: boolean;
}

function GroupDetailsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { goBack, goBackTo } = useAppNavigation();
  const queryClient = useQueryClient();
  const { groupId } = useParams();
  const id = Number(groupId) || 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: GroupTab = TABS.includes(tabParam as GroupTab) ? (tabParam as GroupTab) : 'expenses';
  const filterParam = searchParams.get('filter') as ExpenseFilter;
  const filter: ExpenseFilter = FILTERS.includes(filterParam) ? filterParam : 'all';

  const { data: group, isLoading, isError, error } = useGroup(id);
  const { data: expenses = [] } = useGroupExpenses(id);
  const { data: settlements = [] } = useGroupSettlements(id);
  const { data: balances } = useGroupBalances(id);
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const leaveGroup = useLeaveGroup();
  const runUndoable = useUndoableAction();

  const [expenseDialog, setExpenseDialog] = useState<ExpenseDialogState>({ open: false, expense: null, fillAmount: false });
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementPreset, setSettlementPreset] = useState<SettlementPreset | null>(null);
  const [ledgerMember, setLedgerMember] = useState<number | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveKeep, setLeaveKeep] = useState('keep');

  const members = useMemo(() => new Map<number, GroupMember>((group?.members ?? []).map((member) => [member.id, member])), [group]);

  const setParams = (next: { tab?: GroupTab; filter?: ExpenseFilter }) => {
    const params: Record<string, string> = {};
    const nextTab = next.tab ?? tab;
    const nextFilter = next.filter ?? (next.tab && next.tab !== 'expenses' ? 'all' : filter);
    if (nextTab !== 'expenses') {
      params.tab = nextTab;
    }
    if (nextFilter !== 'all') {
      params.filter = nextFilter;
    }
    setSearchParams(params, { replace: true });
  };

  if (isLoading) {
    return <Container maxWidth="md" id="group-details-page"><Box className="loading-container"><CircularProgress /></Box></Container>;
  }

  if (isError || !group) {
    return (
      <Container maxWidth="md" id="group-details-page">
        <EmptyState
          title={isGroupError(error, NOT_FOUND) ? t('GROUP_NOT_FOUND') : t('GROUPS_LOAD_ERROR')}
          actions={<Button variant="outlined" onClick={() => navigate('/groups')}>{t('GROUP_GO_TO_GROUPS')}</Button>}
        />
      </Container>
    );
  }

  const isOwner = group.me.role === GroupMemberRole.OWNER;
  const archived = !!group.archivedAt;
  const dates = formatDateRange(group.startDate, group.endDate, i18n.language);
  const currency = group.baseCurrency;
  const myNet = balances?.myNet ?? 0;
  const pendingCount = balances?.pendingCount ?? expenses.filter((expense) => expense.pending).length;
  const pairAmount = balances?.withMe.find((pair) => pair.memberId === ledgerMember)?.amount ?? 0;

  const expensesKey = groupQueryKeys.expenses(group.id);
  const settlementsKey = groupQueryKeys.settlements(group.id);
  const groupKey = groupQueryKeys.group(group.id);
  const failure = (fallbackKey: string) => (failureError: unknown) => toast.error(groupErrorMessage(failureError, t, fallbackKey));

  const openExpense = (expense: GroupExpense | null, fillAmount = false) => {
    if (archived && expense === null) {
      return;
    }
    setExpenseDialog({ open: true, expense, fillAmount });
  };

  const deleteExpense = (expense: GroupExpense) => {
    setExpenseDialog({ open: false, expense: null, fillAmount: false });
    const snapshot = queryClient.getQueryData<GroupExpense[]>(expensesKey);
    runUndoable({
      key: `delete-expense-${expense.id}`,
      message: expense.shares.some((share) => share.tickSettlementId) ? t('GROUP_EXPENSE_DELETED_WITH_TICKS') : t('GROUP_EXPENSE_DELETED'),
      apply: () => {
        queryClient.cancelQueries({ queryKey: expensesKey });
        queryClient.setQueryData<GroupExpense[]>(expensesKey, (old) => old?.filter((item) => item.id !== expense.id));
      },
      revert: () => queryClient.setQueryData(expensesKey, snapshot),
      commit: async () => {
        await groupExpenseApi.remove({ groupId: group.id, expenseId: expense.id, version: expense.version });
        invalidateGroupData(queryClient);
      },
      onError: failure('GROUP_DELETE_ERROR'),
    });
  };

  const clearTick = (shareId: number | null, settlementId: number) => {
    queryClient.setQueryData<GroupExpense[]>(expensesKey, (old) => old?.map((item) => ({
      ...item,
      shares: item.shares.map((share) => (share.id === shareId || share.tickSettlementId === settlementId ? { ...share, tickSettlementId: null } : share)),
    })));
    queryClient.setQueryData<GroupSettlement[]>(settlementsKey, (old) => old?.filter((item) => item.id !== settlementId));
  };

  const removeSettlement = (settlementId: number, shareId: number | null, message: string) => {
    const expenseSnapshot = queryClient.getQueryData<GroupExpense[]>(expensesKey);
    const settlementSnapshot = queryClient.getQueryData<GroupSettlement[]>(settlementsKey);
    runUndoable({
      key: `remove-settlement-${settlementId}`,
      message,
      apply: () => clearTick(shareId, settlementId),
      revert: () => {
        queryClient.setQueryData(expensesKey, expenseSnapshot);
        queryClient.setQueryData(settlementsKey, settlementSnapshot);
      },
      commit: async () => {
        await groupExpenseApi.removeSettlement({ groupId: group.id, settlementId });
        invalidateGroupData(queryClient);
      },
      onError: failure('GROUP_ACTION_ERROR'),
    });
  };

  const untick = (expense: GroupExpense, share: GroupExpenseShare) => {
    if (share.tickSettlementId) {
      removeSettlement(share.tickSettlementId, share.id, t('GROUP_UNTICKED', { title: expense.title }));
    }
  };

  const removePayment = (settlement: GroupSettlement) => removeSettlement(settlement.id, settlement.shareId, t('GROUP_PAYMENT_REMOVED'));

  const removeGuest = (member: GroupMember) => {
    const snapshot = queryClient.getQueryData<Group>(groupKey);
    runUndoable({
      key: `remove-member-${member.id}`,
      message: t('GROUP_PERSON_REMOVED', { name: member.displayName }),
      apply: () => queryClient.setQueryData<Group>(groupKey, (old) => old && { ...old, members: old.members.filter((item) => item.id !== member.id) }),
      revert: () => queryClient.setQueryData(groupKey, snapshot),
      commit: async () => {
        await groupApi.removeMember({ groupId: group.id, memberId: member.id });
        invalidateGroupData(queryClient);
      },
      onError: failure('GROUP_ACTION_ERROR'),
    });
  };

  const openSettlement = (preset: SettlementPreset | null) => {
    setSettlementPreset(preset);
    setSettlementOpen(true);
  };

  const toggleArchive = async () => {
    setMenuAnchor(null);
    try {
      await updateGroup.mutateAsync({ id: group.id, data: { archived: !archived } });
      toast.success(archived ? t('GROUP_UNARCHIVED') : t('GROUP_ARCHIVED'));
    } catch (archiveError) {
      failure('GROUP_ACTION_ERROR')(archiveError);
    }
  };

  const toggleSimplify = async (value: boolean) => {
    try {
      await updateGroup.mutateAsync({ id: group.id, data: { simplifyDebts: value } });
    } catch (simplifyError) {
      failure('GROUP_ACTION_ERROR')(simplifyError);
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteGroup.mutateAsync(group.id);
      toast.success(t('GROUP_DELETED', { name: group.name }));
      goBackTo('/groups');
    } catch (deleteError) {
      failure('GROUP_DELETE_ERROR')(deleteError);
    }
  };

  const confirmLeave = async () => {
    try {
      await leaveGroup.mutateAsync({ groupId: group.id, keepRecords: leaveKeep === 'keep' });
      toast.success(t('GROUP_LEFT', { name: group.name }));
      goBackTo('/groups');
    } catch (leaveError) {
      failure('GROUP_ACTION_ERROR')(leaveError);
    }
  };

  const heroClass = myNet > 0 ? 'owed' : myNet < 0 ? 'owe' : 'settled';
  const heroLabel = myNet > 0 ? t('GROUP_YOU_ARE_OWED') : myNet < 0 ? t('GROUP_YOU_OWE') : t('GROUP_SETTLED_UP');

  return (
    <Container maxWidth="md" id="group-details-page">
      <Box className="page-header">
        <IconButton color="primary" className="back-button" aria-label={t('GROUP_BACK_TO_GROUPS')} onClick={() => goBack('/groups')}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </IconButton>
        <Box className="group-icon" sx={{ color: group.color, backgroundColor: alpha(group.color, 0.18) }}>
          <FontAwesomeIcon icon={groupIcon(group.icon)} />
        </Box>
        <Box className="group-heading">
          <Typography variant="h5" className="page-title">{group.name}</Typography>
          <Typography variant="body2" className="muted">
            {[dates, t('GROUP_PEOPLE_COUNT', { count: group.members.length }), currency].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <IconButton aria-label={t('GROUP_MENU')} onClick={(event) => setMenuAnchor(event.currentTarget)}>
          <FontAwesomeIcon icon={faEllipsisVertical} />
        </IconButton>
      </Box>

      {archived && (
        <Alert
          severity="info"
          variant="outlined"
          icon={<FontAwesomeIcon icon={faBoxArchive} />}
          action={isOwner ? <Button color="inherit" onClick={toggleArchive}>{t('GROUP_UNARCHIVE')}</Button> : undefined}
        >
          {t('GROUP_ARCHIVED_BANNER')}
        </Alert>
      )}

      <Paper className="hero-card">
        <Box className="hero-top">
          <Typography className="muted">{heroLabel}</Typography>
          {myNet !== 0 && <Typography className={`hero-amount ${heroClass}`}>{formatCurrencyAmount(Math.abs(myNet), currency)}</Typography>}
        </Box>
        <Typography variant="body2" className="soft">
          {t('GROUP_SPENT_AND_SHARE', {
            spent: formatCurrencyAmount(balances?.total ?? 0, currency),
            share: formatCurrencyAmount(balances?.myShare ?? 0, currency),
          })}
        </Typography>
        {pendingCount > 0 && (
          <Chip
            className="pending-chip"
            icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
            label={t('GROUP_AMOUNTS_MISSING_FILL', { count: pendingCount })}
            onClick={() => setParams({ tab: 'expenses', filter: 'missing' })}
          />
        )}
        <Box className="hero-actions">
          <Button variant="contained" onClick={() => setParams({ tab: 'balances' })} className="accessible-primary">{t('GROUP_SETTLE_UP')}</Button>
          <Button variant="outlined" onClick={() => setSyncOpen(true)} startIcon={<FontAwesomeIcon icon={faSliders} />}>
            {group.me.syncEnabled ? t('GROUP_MY_RECORDS_ON') : t('GROUP_MY_RECORDS_OFF')}
          </Button>
        </Box>
      </Paper>

      <Tabs value={tab} onChange={(_, value) => setParams({ tab: value })} variant="fullWidth" className="group-tabs" textColor="inherit" indicatorColor="primary">
        <Tab value="expenses" label={t('GROUP_TAB_EXPENSES')} />
        <Tab value="balances" label={t('GROUP_TAB_BALANCES')} />
        <Tab value="stats" label={t('GROUP_TAB_STATS')} />
        <Tab value="people" label={t('GROUP_TAB_PEOPLE')} />
      </Tabs>

      <Box className="tab-content">
        {tab === 'expenses' && (
          <ExpensesTab
            group={group}
            expenses={expenses}
            members={members}
            filter={filter}
            onFilterChange={(value) => setParams({ filter: value })}
            onOpen={(expense) => (archived ? toast.info(t('GROUP_ERROR_ARCHIVED')) : openExpense(expense))}
          />
        )}
        {tab === 'balances' && (balances ? (
          <BalancesTab
            group={group}
            balances={balances}
            members={members}
            onMarkPaid={openSettlement}
            onOpenLedger={setLedgerMember}
            onRecordPayment={() => openSettlement(null)}
            onToggleArchive={toggleArchive}
            onToggleSimplify={toggleSimplify}
          />
        ) : <Box className="loading-container"><CircularProgress /></Box>)}
        {tab === 'stats' && <StatsTab group={group} members={members} />}
        {tab === 'people' && (
          <PeopleTab group={group} onOpenSync={() => setSyncOpen(true)} onRemoveGuest={removeGuest} onLeave={() => setLeaveOpen(true)} />
        )}
      </Box>

      {!archived && (
        <Fab color="primary" className="add-expense-fab" aria-label={t('GROUP_NEW_EXPENSE')} onClick={() => openExpense(null)}>
          <FontAwesomeIcon icon={faPlus} />
        </Fab>
      )}

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {isOwner && (
          <MenuItem onClick={() => { setMenuAnchor(null); setEditOpen(true); }}>
            <ListItemIcon><FontAwesomeIcon icon={faPen} /></ListItemIcon>
            <ListItemText>{t('GROUP_EDIT')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { setMenuAnchor(null); setParams({ tab: 'people' }); }}>
          <ListItemIcon><FontAwesomeIcon icon={faUserPlus} /></ListItemIcon>
          <ListItemText>{t('GROUP_INVITE_PEOPLE')}</ListItemText>
        </MenuItem>
        {isOwner && (
          <MenuItem onClick={toggleArchive}>
            <ListItemIcon><FontAwesomeIcon icon={faBoxArchive} /></ListItemIcon>
            <ListItemText>{archived ? t('GROUP_UNARCHIVE') : t('GROUP_ARCHIVE_KEEP')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { setMenuAnchor(null); setLeaveOpen(true); }}>
          <ListItemIcon><FontAwesomeIcon icon={faRightFromBracket} /></ListItemIcon>
          <ListItemText>{t('GROUP_LEAVE')}</ListItemText>
        </MenuItem>
        {isOwner && (
          <MenuItem onClick={() => { setMenuAnchor(null); setDeleteOpen(true); }} className="danger-item">
            <ListItemIcon><FontAwesomeIcon icon={faTrash} /></ListItemIcon>
            <ListItemText>{t('GROUP_DELETE')}</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <GroupExpenseDialog
        open={expenseDialog.open}
        onClose={() => setExpenseDialog({ open: false, expense: null, fillAmount: false })}
        group={group}
        expenses={expenses}
        expense={expenseDialog.expense}
        fillAmount={expenseDialog.fillAmount}
        onDelete={deleteExpense}
      />
      <SettlementDialog open={settlementOpen} onClose={() => setSettlementOpen(false)} group={group} preset={settlementPreset} />
      <PersonLedgerDialog
        open={ledgerMember !== null}
        onClose={() => setLedgerMember(null)}
        group={group}
        memberId={ledgerMember}
        expenses={expenses}
        settlements={settlements}
        pairAmount={pairAmount}
        onFillAmount={(expense) => { setLedgerMember(null); openExpense(expense, true); }}
        onRecordPayment={(preset) => { setLedgerMember(null); openSettlement(preset); }}
        onUntick={untick}
        onRemovePayment={removePayment}
      />
      <GroupSyncDialog open={syncOpen} onClose={() => setSyncOpen(false)} group={group} />
      <GroupDialog open={editOpen} onClose={() => setEditOpen(false)} group={group} />
      <ConfirmationDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="GROUP_DELETE_TITLE"
        message="GROUP_DELETE_MESSAGE"
        messageParams={{ name: group.name }}
        confirmText="GROUP_DELETE"
        confirmColor="error"
        isLoading={deleteGroup.isPending}
      />
      <AppDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('GROUP_LEAVE_TITLE', { name: group.name })}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>{isOwner ? t('GROUP_LEAVE_OWNER_MESSAGE') : t('GROUP_LEAVE_MESSAGE')}</Typography>
          {(group.me.syncedRecordCount > 0 || group.me.keptRecordCount > 0) && (
            <RadioGroup value={leaveKeep} onChange={(event) => setLeaveKeep(event.target.value)}>
              <FormControlLabel value="keep" control={<Radio color="secondary" />} label={t('GROUP_SYNC_KEEP')} />
              <FormControlLabel value="remove" control={<Radio color="secondary" />} label={t('GROUP_SYNC_REMOVE')} />
            </RadioGroup>
          )}
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button onClick={() => setLeaveOpen(false)}>{t('CANCEL')}</Button>
          <Button color="error" variant="contained" onClick={confirmLeave} disabled={leaveGroup.isPending}>{t('GROUP_LEAVE')}</Button>
        </DialogActions>
      </AppDialog>
    </Container>
  );
}

export default GroupDetailsPage;
