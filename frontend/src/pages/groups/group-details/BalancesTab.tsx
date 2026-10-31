import { Box, Button, ButtonBase, FormControlLabel, LinearProgress, Paper, Stack, Switch, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faBoxArchive, faChevronRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import type { Group, GroupBalances, GroupMember } from '../../../types/groups';
import { formatCurrencyAmount } from '../../../utils/currency';
import MemberAvatar from '../../../components/member-avatar/MemberAvatar';
import type { SettlementPreset } from '../../../components/settlement-dialog/SettlementDialog';

interface BalancesTabProps {
  group: Group;
  balances: GroupBalances;
  members: Map<number, GroupMember>;
  onMarkPaid: (preset: SettlementPreset) => void;
  onOpenLedger: (memberId: number) => void;
  onRecordPayment: () => void;
  onToggleArchive: () => void;
  onToggleSimplify: (value: boolean) => void;
}

function BalancesTab({ group, balances, members, onMarkPaid, onOpenLedger, onRecordPayment, onToggleArchive, onToggleSimplify }: BalancesTabProps) {
  const { t } = useTranslation();
  const currency = balances.currency;
  const archived = !!group.archivedAt;
  const label = (id: number, lower = false) => {
    const member = members.get(id);
    if (!member) {
      return '?';
    }
    if (member.isMe) {
      return lower ? t('GROUP_YOU_LOWER') : t('GROUP_YOU');
    }
    return member.displayName;
  };
  const maxNet = Math.max(1, ...balances.members.map((member) => Math.abs(member.net)));
  const tone = (value: number) => (value > 0 ? 'owed' : value < 0 ? 'owe' : 'settled');

  return (
    <Stack gap={3} className="balances-tab">
      <Stack gap={1}>
        <Box className="section-header">
          <Typography variant="overline" className="muted">{t('GROUP_SUGGESTED_PAYMENTS')}</Typography>
          <FormControlLabel
            control={<Switch checked={group.simplifyDebts} onChange={(event) => onToggleSimplify(event.target.checked)} color="secondary" />}
            label={t('GROUP_SIMPLIFY')}
            labelPlacement="start"
          />
        </Box>
        <Typography variant="caption" className="muted">{group.simplifyDebts ? t('GROUP_SIMPLIFY_ON_HINT') : t('GROUP_SIMPLIFY_OFF_HINT')}</Typography>
        {balances.suggested.length === 0 ? (
          <Paper className="settled-card"><Typography>{t('GROUP_EVERYONE_SETTLED')}</Typography></Paper>
        ) : (
          balances.suggested.map((transfer) => {
            const from = members.get(transfer.fromMemberId);
            const to = members.get(transfer.toMemberId);
            return (
              <Paper key={`${transfer.fromMemberId}-${transfer.toMemberId}`} className="transfer-row">
                {from && <MemberAvatar member={from} size={32} />}
                <FontAwesomeIcon icon={faArrowRight} className="muted" />
                {to && <MemberAvatar member={to} size={32} />}
                <Box className="transfer-text">
                  <Typography variant="body2" className="soft">{t('GROUP_PAYS', { from: label(transfer.fromMemberId), to: label(transfer.toMemberId, true) })}</Typography>
                  <Typography fontWeight={600}>{formatCurrencyAmount(transfer.amount, currency)}</Typography>
                </Box>
                {!archived && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => onMarkPaid({ fromMemberId: transfer.fromMemberId, toMemberId: transfer.toMemberId, amount: transfer.amount })}
                  >
                    {t('GROUP_MARK_PAID')}
                  </Button>
                )}
              </Paper>
            );
          })
        )}
        {balances.pendingCount > 0 && (
          <Typography variant="caption" className="pending-note">
            <FontAwesomeIcon icon={faTriangleExclamation} /> {t('GROUP_PENDING_NOT_COUNTED', { count: balances.pendingCount })}
          </Typography>
        )}
      </Stack>

      <Stack gap={1}>
        <Typography variant="overline" className="muted">{t('GROUP_EVERYONE')}</Typography>
        <Paper className="everyone-card">
          {balances.members.map((entry) => {
            const member = members.get(entry.memberId);
            return (
              <Box key={entry.memberId} className="everyone-row">
                <Box className="everyone-line">
                  {member && <MemberAvatar member={member} size={28} />}
                  <Typography className="everyone-name">{label(entry.memberId)}</Typography>
                  <Typography className={`everyone-amount ${tone(entry.net)}`}>
                    {entry.net > 0 ? '+' : entry.net < 0 ? '-' : ''}{formatCurrencyAmount(Math.abs(entry.net), currency)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(Math.abs(entry.net) / maxNet) * 100}
                  className={`everyone-bar ${tone(entry.net)}`}
                  aria-label={label(entry.memberId)}
                />
              </Box>
            );
          })}
        </Paper>
      </Stack>

      <Stack gap={1}>
        <Typography variant="overline" className="muted">{t('GROUP_BETWEEN_YOU_AND')}</Typography>
        {balances.withMe.map((pair) => {
          const member = members.get(pair.memberId);
          return (
            <ButtonBase key={pair.memberId} className="between-row" onClick={() => onOpenLedger(pair.memberId)}>
              {member && <MemberAvatar member={member} size={34} />}
              <Box className="between-text">
                <Typography fontWeight={600}>{label(pair.memberId)}</Typography>
                <Typography variant="body2" className={tone(pair.amount)}>
                  {pair.amount > 0
                    ? t('GROUP_OWES_YOU', { amount: formatCurrencyAmount(pair.amount, currency) })
                    : pair.amount < 0
                      ? t('GROUP_YOU_OWE_THEM', { amount: formatCurrencyAmount(-pair.amount, currency) })
                      : t('GROUP_ALL_SQUARE')}
                </Typography>
              </Box>
              <FontAwesomeIcon icon={faChevronRight} className="muted" />
            </ButtonBase>
          );
        })}
      </Stack>

      <Stack gap={1}>
        {!archived && <Button variant="outlined" onClick={onRecordPayment} className="tall-button">{t('GROUP_RECORD_PAYMENT')}</Button>}
        <Button variant="outlined" color="info" onClick={onToggleArchive} startIcon={<FontAwesomeIcon icon={faBoxArchive} />} className="tall-button">
          {archived ? t('GROUP_UNARCHIVE') : t('GROUP_ARCHIVE_KEEP')}
        </Button>
      </Stack>
    </Stack>
  );
}

export default BalancesTab;
