import './group-dialog.scss';
import { useEffect, useState, type KeyboardEvent } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPlus } from '@fortawesome/free-solid-svg-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { Group } from '../../types/groups';
import { Currency } from '../../enums/Currency';
import { useSettings } from '../../services/settingService';
import { useCreateGroup, useUpdateGroup } from '../../services/groupService';
import { fromApiDay, GROUP_COLORS, GROUP_ICON_KEYS, groupIcon, toApiDay } from '../../utils/groups';
import { groupErrorMessage } from '../../utils/groupErrors';
import InvitePanel from '../invite-panel/InvitePanel';

interface GroupDialogProps {
  open: boolean;
  onClose: () => void;
  group?: Group | null;
  onCreated?: (group: Group) => void;
}

interface GroupFormInput {
  name: string;
  icon: string;
  color: string;
  baseCurrency: string;
  startDate: Date | null;
  endDate: Date | null;
}

const groupSchema = z
  .object({
    name: z.string().trim().min(1, 'GROUP_NAME_REQUIRED').max(60, 'GROUP_NAME_TOO_LONG'),
    icon: z.string(),
    color: z.string(),
    baseCurrency: z.string().min(1, 'CURRENCY_REQUIRED'),
    startDate: z.date().nullable(),
    endDate: z.date().nullable(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: 'GROUP_END_BEFORE_START',
    path: ['endDate'],
  });

function GroupDialog({ open, onClose, group, onCreated }: GroupDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: settings } = useSettings();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [guestDraft, setGuestDraft] = useState('');
  const [created, setCreated] = useState<Group | null>(null);
  const isEdit = !!group;
  const isSaving = createGroup.isPending || updateGroup.isPending;

  const { control, handleSubmit, reset, formState: { errors } } = useForm<GroupFormInput>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: '', icon: 'city', color: GROUP_COLORS[0], baseCurrency: Currency.MKD, startDate: null, endDate: null },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setCreated(null);
    setGuestDraft('');
    setGuestNames([]);
    reset(group
      ? {
        name: group.name,
        icon: group.icon,
        color: group.color,
        baseCurrency: group.baseCurrency,
        startDate: group.startDate ? fromApiDay(group.startDate) : null,
        endDate: group.endDate ? fromApiDay(group.endDate) : null,
      }
      : { name: '', icon: 'city', color: GROUP_COLORS[0], baseCurrency: settings?.currency || Currency.MKD, startDate: null, endDate: null });
  }, [open, group, settings, reset]);

  const addGuest = () => {
    const name = guestDraft.trim().replace(/\s+/g, ' ');
    if (!name) {
      return;
    }
    if (guestNames.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      toast.error(t('GROUP_ERROR_NAME_TAKEN'));
      return;
    }
    setGuestNames((names) => [...names, name]);
    setGuestDraft('');
  };

  const onGuestKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addGuest();
    }
  };

  const onSubmit = async (data: GroupFormInput) => {
    const payload = {
      name: data.name.trim(),
      icon: data.icon,
      color: data.color,
      baseCurrency: data.baseCurrency,
      startDate: data.startDate ? toApiDay(data.startDate) : '',
      endDate: data.endDate ? toApiDay(data.endDate) : '',
    };
    try {
      if (group) {
        await updateGroup.mutateAsync({ id: group.id, data: payload });
        toast.success(t('GROUP_UPDATED'));
        onClose();
        return;
      }
      const pendingGuest = guestDraft.trim();
      const result = await createGroup.mutateAsync({ ...payload, guestNames: pendingGuest ? [...guestNames, pendingGuest] : guestNames });
      setCreated(result);
    } catch (error) {
      toast.error(groupErrorMessage(error, t, 'GROUP_SAVE_ERROR'));
    }
  };

  const handleClose = () => {
    if (isSaving) {
      return;
    }
    if (created) {
      onCreated?.(created);
    }
    onClose();
  };

  if (created) {
    return (
      <Dialog open={open} onClose={handleClose} id="group-dialog" maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t('GROUP_INVITE_PEOPLE')}</DialogTitle>
        <DialogContent>
          <Stack gap={2} className="group-created">
            <Box className="group-created-check"><FontAwesomeIcon icon={faCheck} /></Box>
            <Typography variant="h6" textAlign="center">{t('GROUP_CREATED_TITLE', { name: created.name })}</Typography>
            <Typography variant="body2" textAlign="center" className="group-created-text">{t('GROUP_CREATED_TEXT')}</Typography>
            <InvitePanel group={created} canManage />
          </Stack>
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button variant="contained" onClick={handleClose} className="submit-button">{t('GROUP_DONE')}</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} id="group-dialog" maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>{isEdit ? t('GROUP_EDIT') : t('GROUP_NEW')}</DialogTitle>
      <DialogContent>
        <form id="group-form" onSubmit={handleSubmit(onSubmit)} className="group-form">
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('GROUP_NAME')}
                placeholder={t('GROUP_NAME_PLACEHOLDER')}
                fullWidth
                autoFocus={!isEdit}
                error={!!errors.name}
                helperText={errors.name ? t(errors.name.message || '') : ''}
                className="form-field"
              />
            )}
          />

          <Typography variant="overline" className="field-label">{t('GROUP_ICON')}</Typography>
          <Controller
            name="color"
            control={control}
            render={({ field: colorField }) => (
              <Controller
                name="icon"
                control={control}
                render={({ field }) => (
                  <Stack gap={1.5}>
                    <Box className="icon-grid">
                      {GROUP_ICON_KEYS.map((key) => (
                        <IconButton
                          key={key}
                          className={`icon-option ${field.value === key ? 'selected' : ''}`}
                          aria-label={t(`GROUP_ICON_${key.toUpperCase()}`)}
                          aria-pressed={field.value === key}
                          onClick={() => field.onChange(key)}
                          sx={field.value === key ? { color: colorField.value, backgroundColor: alpha(colorField.value, 0.2) } : undefined}
                        >
                          <FontAwesomeIcon icon={groupIcon(key)} />
                        </IconButton>
                      ))}
                    </Box>
                    <Box className="color-row" role="radiogroup" aria-label={t('GROUP_COLOR')}>
                      {GROUP_COLORS.map((color) => (
                        <IconButton
                          key={color}
                          role="radio"
                          aria-checked={colorField.value === color}
                          aria-label={color}
                          className={`color-option ${colorField.value === color ? 'selected' : ''}`}
                          onClick={() => colorField.onChange(color)}
                        >
                          <Box className="color-dot" sx={{ backgroundColor: color }} />
                        </IconButton>
                      ))}
                    </Box>
                  </Stack>
                )}
              />
            )}
          />

          <Controller
            name="baseCurrency"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label={t('GROUP_CURRENCY')}
                fullWidth
                disabled={isEdit && group?.hasActivity}
                helperText={isEdit && group?.hasActivity ? t('GROUP_ERROR_CURRENCY_LOCKED') : t('GROUP_CURRENCY_HINT')}
                className="form-field"
              >
                {Object.values(Currency).map((currency) => (
                  <MenuItem key={currency} value={currency}>{currency} · {t(`CURRENCY_${currency}`)}</MenuItem>
                ))}
              </TextField>
            )}
          />

          <Box className="date-row">
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label={t('GROUP_START_DATE')}
                  value={field.value}
                  onChange={(date) => field.onChange(date)}
                  slotProps={{ textField: { fullWidth: true, className: 'form-field' }, field: { clearable: true } }}
                />
              )}
            />
            <Controller
              name="endDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label={t('GROUP_END_DATE')}
                  value={field.value}
                  onChange={(date) => field.onChange(date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      className: 'form-field',
                      error: !!errors.endDate,
                      helperText: errors.endDate ? t(errors.endDate.message || '') : '',
                    },
                    field: { clearable: true },
                  }}
                />
              )}
            />
          </Box>

          {!isEdit && (
            <>
              <Typography variant="overline" className="field-label">{t('GROUP_PEOPLE')}</Typography>
              <Box className="guest-chips">
                <Chip label={t('GROUP_YOU')} className="guest-chip me" />
                {guestNames.map((name) => (
                  <Chip
                    key={name}
                    label={name}
                    className="guest-chip"
                    onDelete={() => setGuestNames((names) => names.filter((n) => n !== name))}
                  />
                ))}
              </Box>
              <Box className="guest-input-row">
                <TextField
                  value={guestDraft}
                  onChange={(event) => setGuestDraft(event.target.value)}
                  onKeyDown={onGuestKeyDown}
                  label={t('GROUP_ADD_FRIEND')}
                  placeholder={t('GROUP_ADD_FRIEND_PLACEHOLDER')}
                  fullWidth
                />
                <Button variant="outlined" onClick={addGuest} startIcon={<FontAwesomeIcon icon={faPlus} />} className="guest-add-button">
                  {t('GROUP_ADD')}
                </Button>
              </Box>
              <Typography variant="caption" className="guest-hint">{t('GROUP_PEOPLE_HINT')}</Typography>
            </>
          )}
        </form>
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button onClick={handleClose} disabled={isSaving} className="cancel-button">{t('CANCEL')}</Button>
        <Button type="submit" form="group-form" variant="contained" disabled={isSaving} className="submit-button">
          {isSaving ? <CircularProgress size={24} /> : isEdit ? t('UPDATE') : t('GROUP_CREATE')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default GroupDialog;
