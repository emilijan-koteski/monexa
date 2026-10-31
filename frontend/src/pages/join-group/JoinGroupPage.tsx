import './join-group-page.scss';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'react-toastify';
import LanguageChange from '../../components/language-change/LanguageChange.tsx';
import { useJoinGroup, useJoinPreview } from '../../services/groupService';
import { formatDateRange, formatInviteInput, groupIcon } from '../../utils/groups';
import { groupErrorMessage } from '../../utils/groupErrors';

const NEW_PERSON = 'new';

const JoinShell = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <div id="join-group-page">
      <Container maxWidth="sm">
        <Box className="join-container">
          <Box className="language-change-container"><LanguageChange/></Box>
          <Paper className="join-paper">
            <Stack gap={3}>
              <Typography variant="h3" component="h1" className="app-title">{t('APP_TITLE')}</Typography>
              {children}
            </Stack>
          </Paper>
        </Box>
      </Container>
    </div>
  );
};

function JoinGroupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { code: rawCode = '' } = useParams();
  const code = formatInviteInput(rawCode);
  const { data: preview, isLoading, isError, error } = useJoinPreview(code);
  const joinGroup = useJoinGroup();
  const [choice, setChoice] = useState<string>(NEW_PERSON);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (preview) {
      setChoice(preview.guests.length > 0 ? String(preview.guests[0].id) : NEW_PERSON);
      setNewName(preview.suggestedName);
    }
  }, [preview]);

  if (isLoading) {
    return <JoinShell><Box className="join-loading"><CircularProgress /></Box></JoinShell>;
  }

  if (isError || !preview) {
    return (
      <JoinShell>
        <Stack gap={2} className="join-state">
          <FontAwesomeIcon icon={faTriangleExclamation} className="join-state-icon" />
          <Typography variant="h6">{groupErrorMessage(error, t, 'GROUP_ERROR_INVITE_INVALID')}</Typography>
          <Typography variant="body2" className="join-muted">{t('GROUP_JOIN_INVALID_HINT')}</Typography>
          <Button variant="outlined" onClick={() => navigate('/groups')}>{t('GROUP_GO_TO_GROUPS')}</Button>
        </Stack>
      </JoinShell>
    );
  }

  const dates = formatDateRange(preview.startDate, preview.endDate, i18n.language);
  const join = async () => {
    try {
      const result = await joinGroup.mutateAsync(
        choice === NEW_PERSON ? { code, displayName: newName.trim() || undefined } : { code, memberId: Number(choice) },
      );
      toast.success(t('GROUP_JOINED', { name: preview.name }));
      navigate(`/groups/${result.groupId}`, { replace: true });
    } catch (joinError) {
      toast.error(groupErrorMessage(joinError, t, 'GROUP_JOIN_ERROR'));
    }
  };

  return (
    <JoinShell>
      <Box className="join-group-header">
        <Box className="join-group-icon" sx={{ color: preview.color, backgroundColor: alpha(preview.color, 0.18) }}>
          <FontAwesomeIcon icon={groupIcon(preview.icon)} />
        </Box>
        <Box>
          <Typography variant="body2" className="join-muted">{t('GROUP_INVITED_TO')}</Typography>
          <Typography variant="h5" fontWeight={600}>{preview.name}</Typography>
          <Typography variant="body2" className="join-muted">
            {[dates, t('GROUP_PEOPLE_COUNT', { count: preview.memberCount }), preview.baseCurrency].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </Box>

      {preview.alreadyMember ? (
        <Stack gap={2}>
          <Typography>{t('GROUP_ALREADY_IN')}</Typography>
          <Button variant="contained" onClick={() => navigate(`/groups/${preview.groupId}`, { replace: true })}>{t('GROUP_OPEN')}</Button>
        </Stack>
      ) : (
        <Stack gap={2}>
          <Typography variant="overline" className="join-muted">{t('GROUP_WHICH_ONE_ARE_YOU')}</Typography>
          <RadioGroup value={choice} onChange={(event) => setChoice(event.target.value)} className="join-options">
            {preview.guests.map((guest) => (
              <FormControlLabel
                key={guest.id}
                value={String(guest.id)}
                control={<Radio color="secondary" />}
                label={guest.displayName}
                className={`join-option ${choice === String(guest.id) ? 'selected' : ''}`}
              />
            ))}
            <FormControlLabel
              value={NEW_PERSON}
              control={<Radio color="secondary" />}
              label={t('GROUP_JOIN_AS_NEW')}
              className={`join-option ${choice === NEW_PERSON ? 'selected' : ''}`}
            />
          </RadioGroup>
          {choice === NEW_PERSON && (
            <TextField
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              label={t('GROUP_YOUR_NAME_IN_GROUP')}
              fullWidth
            />
          )}
          <Button variant="contained" size="large" onClick={join} disabled={joinGroup.isPending} className="join-button">
            {joinGroup.isPending ? <CircularProgress size={24} /> : t('GROUP_JOIN')}
          </Button>
          <Typography variant="caption" className="join-muted join-privacy">{t('GROUP_JOIN_PRIVACY')}</Typography>
        </Stack>
      )}
    </JoinShell>
  );
}

export default JoinGroupPage;
