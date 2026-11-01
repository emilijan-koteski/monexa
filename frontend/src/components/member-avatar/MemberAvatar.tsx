import './member-avatar.scss';
import { Avatar, Badge, Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import type { GroupMember } from '../../types/groups';
import { memberColor, memberInitial } from '../../utils/groups';

type AvatarMember = Pick<GroupMember, 'id' | 'displayName' | 'isMe' | 'isLinked'>;

interface MemberAvatarProps {
  member: AvatarMember;
  size?: number;
  showLinkBadge?: boolean;
}

function MemberAvatar({ member, size = 36, showLinkBadge = false }: MemberAvatarProps) {
  const { t } = useTranslation();
  const color = memberColor(member);
  const label = member.isMe ? t('GROUP_YOU') : member.displayName;
  const avatar = (
    <Avatar
      className="member-avatar"
      alt={label}
      sx={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        color,
        backgroundColor: alpha(color, 0.18),
        border: `2px ${member.isLinked ? 'solid' : 'dashed'} ${color}`,
      }}
    >
      {member.isMe ? memberInitial(t('GROUP_YOU')) : memberInitial(member.displayName)}
    </Avatar>
  );

  if (!showLinkBadge || !member.isLinked) {
    return avatar;
  }
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      badgeContent={<FontAwesomeIcon icon={faCheck} className="member-avatar-badge" aria-label={t('GROUP_LINKED')} />}
    >
      {avatar}
    </Badge>
  );
}

interface MemberAvatarGroupProps {
  members: AvatarMember[];
  size?: number;
  max?: number;
}

export function MemberAvatarGroup({ members, size = 30, max = 5 }: MemberAvatarGroupProps) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <Box className="member-avatar-group">
      {shown.map((member) => (
        <MemberAvatar key={member.id} member={member} size={size} />
      ))}
      {extra > 0 && (
        <Avatar className="member-avatar member-avatar-extra" sx={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
          +{extra}
        </Avatar>
      )}
    </Box>
  );
}

export default MemberAvatar;
