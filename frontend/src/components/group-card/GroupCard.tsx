import './group-card.scss';
import { Box, Card, CardActionArea, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import type { GroupSummary } from '../../types/groups';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatDateRange, groupIcon } from '../../utils/groups';
import { MemberAvatarGroup } from '../member-avatar/MemberAvatar';

interface GroupCardProps {
  group: GroupSummary;
  onOpen: (group: GroupSummary) => void;
}

function GroupCard({ group, onOpen }: GroupCardProps) {
  const { t, i18n } = useTranslation();
  const dates = formatDateRange(group.startDate, group.endDate, i18n.language);
  const balanceClass = group.myNet > 0 ? 'owed' : group.myNet < 0 ? 'owe' : 'settled';
  const balanceText = group.myNet > 0
    ? t('GROUP_YOU_ARE_OWED_AMOUNT', { amount: formatCurrencyAmount(group.myNet, group.baseCurrency) })
    : group.myNet < 0
      ? t('GROUP_YOU_OWE_AMOUNT', { amount: formatCurrencyAmount(-group.myNet, group.baseCurrency) })
      : group.expenseCount > 0 ? t('GROUP_SETTLED_UP') : t('GROUP_NO_EXPENSES_YET');

  return (
    <Card className="group-card">
      <CardActionArea className="group-card-action" onClick={() => onOpen(group)}>
        <Box className="group-card-top">
          <Box className="group-card-icon" sx={{ color: group.color, backgroundColor: alpha(group.color, 0.18) }}>
            <FontAwesomeIcon icon={groupIcon(group.icon)} />
          </Box>
          <Box className="group-card-title">
            <Typography variant="h6" className="group-card-name">{group.name}</Typography>
            <Typography variant="body2" className="group-card-meta">
              {t('GROUP_PEOPLE_COUNT', { count: group.members.length })} · {group.baseCurrency}
            </Typography>
          </Box>
          {dates && <Typography variant="body2" className="group-card-dates">{dates}</Typography>}
        </Box>
        <Box className="group-card-bottom">
          <MemberAvatarGroup members={group.members} />
          <Typography className={`group-card-balance ${balanceClass}`}>{balanceText}</Typography>
        </Box>
        {group.pendingCount > 0 && (
          <Chip
            size="small"
            className="group-card-pending"
            icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
            label={t('GROUP_AMOUNTS_MISSING', { count: group.pendingCount })}
          />
        )}
      </CardActionArea>
    </Card>
  );
}

export default GroupCard;
