import './category-dialog.scss';
import { useEffect } from 'react';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, useMediaQuery, useTheme } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { Category } from '../../types/models';
import { CategoryType } from '../../enums/CategoryType';

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => void;
  category?: Category | null;
  isLoading?: boolean;
}

export interface CategoryFormData {
  name: string;
  type: CategoryType;
  description?: string;
  color?: string;
}

const categorySchema = z.object({
  name: z.string().min(1, 'CATEGORY_NAME_REQUIRED'),
  type: z.enum([CategoryType.INCOME, CategoryType.EXPENSE], { errorMap: () => ({ message: 'CATEGORY_TYPE_REQUIRED' }), }),
  description: z.string().optional(),
  color: z.string().optional(),
});

function CategoryDialog({
  open,
  onClose,
  onSubmit,
  category,
  isLoading = false,
}: CategoryDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: CategoryType.EXPENSE,
      description: '',
      color: '#1976d2',
    },
  });

  useEffect(() => {
    if (open) {
      if (category) {
        reset({
          name: category.name,
          type: category.type,
          description: category.description || '',
          color: category.color || '#1976d2',
        });
      } else {
        reset({
          name: '',
          type: CategoryType.EXPENSE,
          description: '',
          color: '#1976d2',
        });
      }
    }
  }, [open, category, reset]);

  const handleFormSubmit = (data: CategoryFormData) => {
    onSubmit(data);
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      id="category-dialog"
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        {category ? t('EDIT_CATEGORY') : t('NEW_CATEGORY')}
      </DialogTitle>

      <DialogContent className='dialog-content'>
        <form id="category-form" onSubmit={handleSubmit(handleFormSubmit)}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('CATEGORY_NAME')}
                fullWidth
                autoFocus
                error={!!errors.name}
                helperText={errors.name ? t(errors.name.message || '') : ''}
                placeholder={t('CATEGORY_NAME_PLACEHOLDER')}
              />
            )}
          />

          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label={t('CATEGORY_TYPE')}
                fullWidth
                error={!!errors.type}
                helperText={errors.type ? t(errors.type.message || '') : ''}
              >
                <MenuItem value={CategoryType.EXPENSE}>{t('EXPENSE')}</MenuItem>
                <MenuItem value={CategoryType.INCOME}>{t('INCOME')}</MenuItem>
              </TextField>
            )}
          />

          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="color"
                label={t('CATEGORY_COLOR')}
                fullWidth
                error={!!errors.color}
                helperText={errors.color ? t(errors.color.message || '') : ''}
                className="color-field"
              />
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('CATEGORY_DESCRIPTION')}
                fullWidth
                multiline
                rows={3}
                error={!!errors.description}
                helperText={errors.description ? t(errors.description.message || '') : ''}
                placeholder={t('CATEGORY_DESCRIPTION_PLACEHOLDER')}
              />
            )}
          />
        </form>
      </DialogContent>

      <DialogActions className="dialog-actions">
        <Button onClick={handleClose} disabled={isLoading} className="cancel-button">
          {t('CANCEL')}
        </Button>
        <Button
          type="submit"
          form="category-form"
          variant="contained"
          color="primary"
          disabled={isLoading}
          className="submit-button"
        >
          {isLoading ? (
            <CircularProgress size={24} />
          ) : category ? (
            t('UPDATE')
          ) : (
            t('CREATE')
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CategoryDialog;
