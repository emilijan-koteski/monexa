import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown, faEllipsisVertical, faLinkSlash, faPen, faRightFromBracket, faSliders, faTrash, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { Group, GroupMember } from '../../../types/groups';
import { GroupMemberRole } from '../../../enums/GroupMemberRole';
import { useAddMember, useUnlinkMember, useUpdateMember } from '../../../services/groupService';
import { groupErrorMessage } from '../../../utils/groupErrors';
import MemberAvatar from '../../../components/member-avatar/MemberAvatar';
import InvitePanel from '../../../components/invite-panel/InvitePanel';

interface PeopleTabProps {
  group: Group;
  onOpenSync: () => void;
  onRemoveGuest: (member: GroupMember) => void;
  onLeave: () => void;
}

function PeopleTab({ group, onOpenSync, onRemoveGuest, onLeave }: PeopleTabProps) {
  const { t } = useTranslation();
  const isOwner = group.me.role === GroupMemberRole.OWNER;
  const archived = !!group.archivedAt;
  const addMember = useAddMember();
  const updateMember = useUpdateMember();
  const unlinkMember = useUnlinkMember();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [menu, setMenu] = useState<{ anchor: HTMLElement; member: GroupMember } | null>(null);
  const [renaming, setRenaming] = useState<{ member: GroupMember; value: string } | null>(null);

  const run = async (action: () => Promise<unknown>, successKey: string) => {
    try {
      await action();
      toast.success(t(successKey));
    } catch (error) {
      toast.error(groupErrorMessage(error, t, 'GROUP_ACTION_ERROR'));
    }
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    await run(() => addMember.mutateAsync({ groupId: group.id, displayName: name }), 'GROUP_PERSON_ADDED');
    setNewName('');
    setAdding(false);
  };

  const rename = async () => {
    if (!renaming) {
      return;
    }
    const value = renaming.value.trim();
    if (value && value !== renaming.member.displayName) {
      await run(() => updateMember.mutateAsync({ groupId: group.id, memberId: renaming.member.id, displayName: value }), 'GROUP_PERSON_RENAMED');
    }
    setRenaming(null);
  };

  const closeMenu = () => setMenu(null);

  return (
    <Stack gap={2.5} className="people-tab">
      <Paper className="people-card">
        {group.members.map((member) => (
          <Box key={member.id} className="person-row">
            <MemberAvatar member={member} size={40} showLinkBadge />
            <Box className="person-text">
              {renaming?.member.id === member.id ? (
                <TextField
                  size="small"
                  value={renaming.value}
                  autoFocus
                  onChange={(event) => setRenaming({ member, value: event.target.value })}
                  onBlur={rename}
                  onKeyDown={(event) => event.key === 'Enter' && rename()}
                  aria-label={t('GROUP_RENAME')}
                />
              ) : (
                <Typography fontWeight={600}>{member.isMe ? t('GROUP_YOU') : member.displayName}</Typography>
              )}
              <Typography variant="caption" className="muted">
                {member.role === GroupMemberRole.OWNER ? `${t('GROUP_OWNER')} · ` : ''}
                {member.isLinked ? t('GROUP_LINKED_ACCOUNT') : t('GROUP_GUEST_NOT_LINKED')}
              </Typography>
            </Box>
            <Chip size="small" label={member.isLinked ? t('GROUP_LINKED') : t('GROUP_GUEST')} className={`status-chip ${member.isLinked ? 'linked' : 'guest'}`} />
            {member.isMe && (
              <IconButton aria-label={t('GROUP_SYNC_TITLE')} onClick={onOpenSync}>
                <FontAwesomeIcon icon={faSliders} />
              </IconButton>
            )}
            {isOwner && !member.isMe && (
              <IconButton aria-label={t('GROUP_PERSON_ACTIONS', { name: member.displayName })} onClick={(event) => setMenu({ anchor: event.currentTarget, member })}>
                <FontAwesomeIcon icon={faEllipsisVertical} />
              </IconButton>
            )}
          </Box>
        ))}
        {isOwner && !archived && (
          adding ? (
            <Box className="add-person-row">
              <TextField
                size="small"
                value={newName}
                autoFocus
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && add()}
                label={t('GROUP_NAME_OF_PERSON')}
                fullWidth
              />
              <Button variant="contained" onClick={add} disabled={addMember.isPending}>{t('GROUP_ADD')}</Button>
            </Box>
          ) : (
            <Button onClick={() => setAdding(true)} startIcon={<FontAwesomeIcon icon={faUserPlus} />} className="add-person-button">
              {t('GROUP_ADD_PERSON')}
            </Button>
          )
        )}
      </Paper>

      <InvitePanel group={group} canManage={isOwner} />

      <Button color="error" variant="outlined" onClick={onLeave} startIcon={<FontAwesomeIcon icon={faRightFromBracket} />} className="tall-button">
        {t('GROUP_LEAVE')}
      </Button>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={closeMenu}>
        {menu && [
          <MenuItem key="rename" onClick={() => { setRenaming({ member: menu.member, value: menu.member.displayName }); closeMenu(); }}>
            <ListItemIcon><FontAwesomeIcon icon={faPen} /></ListItemIcon>
            <ListItemText>{t('GROUP_RENAME')}</ListItemText>
          </MenuItem>,
          menu.member.isLinked && (
            <MenuItem key="owner" onClick={() => { run(() => updateMember.mutateAsync({ groupId: group.id, memberId: menu.member.id, role: GroupMemberRole.OWNER }), 'GROUP_OWNER_TRANSFERRED'); closeMenu(); }}>
              <ListItemIcon><FontAwesomeIcon icon={faCrown} /></ListItemIcon>
              <ListItemText>{t('GROUP_MAKE_OWNER')}</ListItemText>
            </MenuItem>
          ),
          menu.member.isLinked && (
            <MenuItem key="unlink" onClick={() => { run(() => unlinkMember.mutateAsync({ groupId: group.id, memberId: menu.member.id }), 'GROUP_UNLINKED'); closeMenu(); }}>
              <ListItemIcon><FontAwesomeIcon icon={faLinkSlash} /></ListItemIcon>
              <ListItemText primary={t('GROUP_UNLINK')} secondary={t('GROUP_UNLINK_HINT')} />
            </MenuItem>
          ),
          <MenuItem key="remove" onClick={() => { onRemoveGuest(menu.member); closeMenu(); }}>
            <ListItemIcon><FontAwesomeIcon icon={faTrash} /></ListItemIcon>
            <ListItemText primary={t('GROUP_REMOVE_PERSON')} secondary={t('GROUP_REMOVE_PERSON_HINT')} />
          </MenuItem>,
        ]}
      </Menu>
    </Stack>
  );
}

export default PeopleTab;
