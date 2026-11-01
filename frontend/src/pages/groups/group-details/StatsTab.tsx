import { Box, CircularProgress, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Group, GroupMember } from '../../../types/groups';
import { useGroupStats } from '../../../services/groupExpenseService';
import { formatCurrencyAmount } from '../../../utils/currency';
import { CATEGORY_META, dateLocale, fromApiDay } from '../../../utils/groups';
import MemberAvatar from '../../../components/member-avatar/MemberAvatar';
import EmptyState from '../../../components/empty-state/EmptyState';

interface StatsTabProps {
  group: Group;
  members: Map<number, GroupMember>;
}

const BAR_HEIGHT = 110;

function StatsTab({ group, members }: StatsTabProps) {
  const { t, i18n } = useTranslation();
  const { data: stats, isLoading } = useGroupStats(group.id);
  if (isLoading || !stats) {
    return <Box className="loading-container"><CircularProgress /></Box>;
  }
  if (stats.total === 0) {
    return <EmptyState title={t('GROUP_STATS_EMPTY_TITLE')} message={t('GROUP_STATS_EMPTY_MESSAGE')} />;
  }
  const currency = stats.currency;
  const locale = dateLocale(i18n.language);
  const kpis = [
    { label: t('GROUP_STAT_TOTAL'), value: stats.total },
    { label: t('GROUP_STAT_MY_SHARE'), value: stats.myShare },
    { label: t('GROUP_STAT_MY_PAID'), value: stats.myPaid },
    { label: t('GROUP_STAT_PER_DAY'), value: stats.perDay },
  ];
  const maxCategory = Math.max(1, ...stats.byCategory.map((item) => item.amount));
  const maxMember = Math.max(1, ...stats.byMember.flatMap((item) => [item.paid, item.share]));
  const maxPeriod = Math.max(1, ...stats.byPeriod.map((item) => item.amount));
  const periodLabel = (period: string) =>
    stats.granularity === 'MONTH' ? format(fromApiDay(`${period}-01`), 'MMM yy', { locale }) : format(fromApiDay(period), 'EEE d', { locale });
  const name = (id: number) => {
    const member = members.get(id);
    return member ? (member.isMe ? t('GROUP_YOU') : member.displayName) : '?';
  };

  return (
    <Stack gap={3} className="stats-tab">
      <Box className="kpi-grid">
        {kpis.map((kpi) => (
          <Paper key={kpi.label} className="kpi">
            <Typography variant="caption" className="muted">{kpi.label}</Typography>
            <Typography className="kpi-value">{formatCurrencyAmount(kpi.value, currency)}</Typography>
          </Paper>
        ))}
      </Box>
      {stats.pendingCount > 0 && (
        <Typography variant="caption" className="pending-note">
          <FontAwesomeIcon icon={faTriangleExclamation} /> {t('GROUP_PENDING_NOT_COUNTED', { count: stats.pendingCount })}
        </Typography>
      )}

      <Stack gap={1}>
        <Typography variant="overline" className="muted">{t('GROUP_STATS_BY_CATEGORY')}</Typography>
        <Paper className="stat-card">
          {stats.byCategory.map((item) => {
            const meta = CATEGORY_META[item.category];
            return (
              <Box key={item.category} className="stat-row">
                <Box className="stat-line">
                  <FontAwesomeIcon icon={meta.icon} style={{ color: meta.color }} className="stat-icon" />
                  <Typography className="stat-name">{t(meta.labelKey)}</Typography>
                  <Typography fontWeight={600}>{formatCurrencyAmount(item.amount, currency)}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(item.amount / maxCategory) * 100}
                  className="stat-bar"
                  sx={{ '& .MuiLinearProgress-bar': { backgroundColor: meta.color } }}
                  aria-label={t(meta.labelKey)}
                />
              </Box>
            );
          })}
        </Paper>
      </Stack>

      <Stack gap={1}>
        <Box className="section-header">
          <Typography variant="overline" className="muted">{t('GROUP_STATS_PAID_VS_SHARE')}</Typography>
          <Box className="legend">
            <span className="legend-dot paid" />{t('GROUP_STATS_PAID')}
            <span className="legend-dot share" />{t('GROUP_STATS_SHARE')}
          </Box>
        </Box>
        <Paper className="stat-card">
          {stats.byMember.map((item) => {
            const member = members.get(item.memberId);
            return (
              <Box key={item.memberId} className="stat-row">
                <Box className="stat-line">
                  {member && <MemberAvatar member={member} size={26} />}
                  <Typography className="stat-name">{name(item.memberId)}</Typography>
                </Box>
                <Box className="pair-bar">
                  <LinearProgress variant="determinate" value={(item.paid / maxMember) * 100} className="stat-bar paid" aria-label={t('GROUP_STATS_PAID')} />
                  <Typography variant="caption" className="pair-value">{formatCurrencyAmount(item.paid, currency)}</Typography>
                </Box>
                <Box className="pair-bar">
                  <LinearProgress variant="determinate" value={(item.share / maxMember) * 100} className="stat-bar share" aria-label={t('GROUP_STATS_SHARE')} />
                  <Typography variant="caption" className="pair-value">{formatCurrencyAmount(item.share, currency)}</Typography>
                </Box>
              </Box>
            );
          })}
        </Paper>
      </Stack>

      {stats.byPeriod.length > 0 && (
        <Stack gap={1}>
          <Typography variant="overline" className="muted">
            {stats.granularity === 'MONTH' ? t('GROUP_STATS_PER_MONTH') : t('GROUP_STATS_PER_DAY')}
          </Typography>
          <Paper className="period-chart" role="img" aria-label={t('GROUP_STATS_PER_DAY')}>
            {stats.byPeriod.map((item) => (
              <Box key={item.period} className="period-column">
                <Typography variant="caption" className="soft">{item.amount ? Math.round(item.amount).toLocaleString() : ''}</Typography>
                <Box className="period-bar" sx={{ height: Math.max(3, Math.round((item.amount / maxPeriod) * BAR_HEIGHT)) }} />
                <Typography variant="caption" className="muted">{periodLabel(item.period)}</Typography>
              </Box>
            ))}
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}

export default StatsTab;
