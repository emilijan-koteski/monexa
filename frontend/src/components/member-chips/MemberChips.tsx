import './member-chips.scss';
import { Box, Chip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import type { GroupMember } from '../../types/groups';
import MemberAvatar from '../member-avatar/MemberAvatar';

interface MemberChipsProps {
  members: GroupMember[];
  selected: number[];
  onToggle: (memberId: number) => void;
  showCheck?: boolean;
  disabled?: boolean;
}

function MemberChips({ members, selected, onToggle, showCheck = false, disabled = false }: MemberChipsProps) {
  const { t } = useTranslation();
  return (
    <Box className="member-chips">
      {members.map((member) => {
        const isSelected = selected.includes(member.id);
        return (
          <Chip
            key={member.id}
            className={`member-chip ${isSelected ? 'selected' : ''}`}
            avatar={<MemberAvatar member={member} size={26} />}
            label={member.isMe ? t('GROUP_YOU') : member.displayName}
            onClick={() => onToggle(member.id)}
            disabled={disabled}
            aria-pressed={isSelected}
            deleteIcon={showCheck && isSelected ? <FontAwesomeIcon icon={faCheck} /> : undefined}
            onDelete={showCheck && isSelected ? () => onToggle(member.id) : undefined}
          />
        );
      })}
    </Box>
  );
}

export default MemberChips;
