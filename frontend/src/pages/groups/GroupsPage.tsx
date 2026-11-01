import './groups-page.scss';
import { useState } from 'react';
import { Box, Button, Chip, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useGroups } from '../../services/groupService';
import type { Group, GroupSummary } from '../../types/groups';
import GroupCard from '../../components/group-card/GroupCard';
import GroupDialog from '../../components/group-dialog/GroupDialog';
import JoinCodeDialog from '../../components/join-code-dialog/JoinCodeDialog';
import EmptyState from '../../components/empty-state/EmptyState';

type GroupsTab = 'active' | 'archived';

function GroupsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: GroupsTab = searchParams.get('tab') === 'archived' ? 'archived' : 'active';
  const { data: groups, isLoading, isError, refetch } = useGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const visible = (groups ?? []).filter((group) => (tab === 'archived' ? !!group.archivedAt : !group.archivedAt));
  const archivedCount = (groups ?? []).filter((group) => !!group.archivedAt).length;

  const setTab = (next: GroupsTab) => {
    setSearchParams(next === 'active' ? {} : { tab: next }, { replace: true });
  };

  const openGroup = (group: GroupSummary) => navigate(`/groups/${group.id}`);
  const onCreated = (group: Group) => navigate(`/groups/${group.id}`);

  return (
    <Container maxWidth="md" id="groups-page">
      <Box className="page-header">
        <Typography variant="h5" className="page-title">{t('GROUPS_TITLE')}</Typography>
      </Box>

      <Box className="groups-actions">
        <Button variant="outlined" onClick={() => setJoinOpen(true)} startIcon={<FontAwesomeIcon icon={faLink} />}>
          {t('GROUP_JOIN_WITH_CODE')}
        </Button>
        <Button variant="contained" onClick={() => setCreateOpen(true)} startIcon={<FontAwesomeIcon icon={faPlus} />} className="accessible-primary">
          {t('GROUP_NEW')}
        </Button>
      </Box>

      <Stack direction="row" gap={1} className="groups-tabs">
        <Chip
          label={t('GROUPS_ACTIVE')}
          onClick={() => setTab('active')}
          color={tab === 'active' ? 'secondary' : 'default'}
          variant={tab === 'active' ? 'filled' : 'outlined'}
          aria-pressed={tab === 'active'}
        />
        <Chip
          label={`${t('GROUPS_ARCHIVED')}${archivedCount ? ` · ${archivedCount}` : ''}`}
          onClick={() => setTab('archived')}
          color={tab === 'archived' ? 'secondary' : 'default'}
          variant={tab === 'archived' ? 'filled' : 'outlined'}
          aria-pressed={tab === 'archived'}
        />
      </Stack>

      {isLoading ? (
        <Box className="loading-container"><CircularProgress /></Box>
      ) : isError ? (
        <EmptyState
          title={t('GROUPS_LOAD_ERROR')}
          actions={<Button variant="outlined" onClick={() => refetch()}>{t('GROUP_RETRY')}</Button>}
        />
      ) : visible.length > 0 ? (
        <Stack gap={1.5}>
          {visible.map((group) => (
            <GroupCard key={group.id} group={group} onOpen={openGroup} />
          ))}
        </Stack>
      ) : tab === 'archived' ? (
        <EmptyState title={t('GROUPS_NO_ARCHIVED_TITLE')} message={t('GROUPS_NO_ARCHIVED_MESSAGE')} />
      ) : (
        <EmptyState
          title={t('GROUPS_EMPTY_TITLE')}
          message={t('GROUPS_EMPTY_MESSAGE')}
          actions={(
            <>
              <Button variant="contained" onClick={() => setCreateOpen(true)} className="accessible-primary">{t('GROUP_NEW')}</Button>
              <Button variant="outlined" onClick={() => setJoinOpen(true)}>{t('GROUP_JOIN_WITH_CODE')}</Button>
            </>
          )}
        />
      )}

      <GroupDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onCreated} />
      <JoinCodeDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </Container>
  );
}

export default GroupsPage;
