import './invite-panel.scss';
import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsRotate, faCopy, faQrcode, faShareNodes } from '@fortawesome/free-solid-svg-icons';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { Group } from '../../types/groups';
import { useDisableInvite, useRegenerateInvite } from '../../services/groupService';
import { inviteLink } from '../../utils/groups';

interface InvitePanelProps {
  group: Group;
  canManage: boolean;
}

function InvitePanel({ group, canManage }: InvitePanelProps) {
  const { t } = useTranslation();
  const [showQr, setShowQr] = useState(false);
  const regenerate = useRegenerateInvite();
  const disable = useDisableInvite();
  const code = group.inviteCode;
  const link = code ? inviteLink(code) : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('GROUP_INVITE_COPIED'));
    } catch {
      toast.error(t('GROUP_INVITE_COPY_ERROR'));
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: group.name, text: t('GROUP_INVITE_SHARE_TEXT', { name: group.name }), url: link });
      } catch {
        return;
      }
      return;
    }
    await copyLink();
  };

  const newCode = async () => {
    try {
      await regenerate.mutateAsync(group.id);
      toast.success(t('GROUP_INVITE_NEW_CODE_DONE'));
    } catch {
      toast.error(t('GROUP_ACTION_ERROR'));
    }
  };

  const turnOff = async () => {
    try {
      await disable.mutateAsync(group.id);
      setShowQr(false);
      toast.success(t('GROUP_INVITE_TURNED_OFF'));
    } catch {
      toast.error(t('GROUP_ACTION_ERROR'));
    }
  };

  return (
    <Paper className="invite-panel">
      <Typography variant="overline" className="invite-panel-label">{t('GROUP_INVITE_CODE')}</Typography>
      {code ? (
        <Stack gap={1.5}>
          <Typography className="invite-code" aria-label={t('GROUP_INVITE_CODE')}>{code}</Typography>
          <Typography variant="body2" className="invite-hint">{t('GROUP_INVITE_HINT')}</Typography>
          <Box className="invite-actions">
            <Button variant="outlined" onClick={copyLink} startIcon={<FontAwesomeIcon icon={faCopy} />}>{t('GROUP_INVITE_COPY')}</Button>
            <Button variant="outlined" onClick={shareLink} startIcon={<FontAwesomeIcon icon={faShareNodes} />}>{t('GROUP_INVITE_SHARE')}</Button>
            <Button
              variant={showQr ? 'contained' : 'outlined'}
              color="secondary"
              onClick={() => setShowQr((value) => !value)}
              aria-pressed={showQr}
              startIcon={<FontAwesomeIcon icon={faQrcode} />}
            >
              {t('GROUP_INVITE_QR')}
            </Button>
          </Box>
          {showQr && (
            <Box className="invite-qr">
              <QRCodeSVG value={link} size={176} marginSize={2} title={t('GROUP_INVITE_QR_TITLE')} />
            </Box>
          )}
          {canManage && (
            <Box className="invite-owner-actions">
              <Button onClick={newCode} disabled={regenerate.isPending} startIcon={<FontAwesomeIcon icon={faArrowsRotate} />}>
                {t('GROUP_INVITE_NEW_CODE')}
              </Button>
              <Button color="error" onClick={turnOff} disabled={disable.isPending}>{t('GROUP_INVITE_TURN_OFF')}</Button>
            </Box>
          )}
        </Stack>
      ) : (
        <Stack gap={1.5}>
          <Typography variant="body2" className="invite-hint">{t('GROUP_INVITE_OFF')}</Typography>
          {canManage && (
            <Button variant="contained" onClick={newCode} disabled={regenerate.isPending}>{t('GROUP_INVITE_TURN_ON')}</Button>
          )}
        </Stack>
      )}
    </Paper>
  );
}

export default InvitePanel;
