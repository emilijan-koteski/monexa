import './trend-report-dialog.scss';
import { useEffect, useRef, useState } from 'react';
import { Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, useMediaQuery, useTheme } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { Category, TrendReport } from '../../types/models';
import { CategoryType } from '../../enums/CategoryType';
import { useCategories } from '../../services/categoryService';

const trendReportSchema = z.object({
  title: z.string(),
  description: z.string(),
  color: z.string(),
  categoryIds: z.array(z.number()).min(1, 'TREND_REPORT_CATEGORIES_REQUIRED'),
});

export type TrendReportFormData = z.infer<typeof trendReportSchema>;

interface TrendReportDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TrendReportFormData) => void;
  report?: TrendReport | null;
  isLoading?: boolean;
}

const SELECT_ALL_ID = -1;

function TrendReportDialog({ open, onClose, onSubmit, report, isLoading = false, }: TrendReportDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: allCategories = [] } = useCategories();

  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const colorSetRef = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TrendReportFormData>({
    resolver: zodResolver(trendReportSchema),
    defaultValues: {
      title: '',
      description: '',
      color: '',
      categoryIds: [],
    },
  });

  const watchedCategoryIds = watch('categoryIds');

  useEffect(() => {
    if (open) {
      colorSetRef.current = false;
      if (report) {
        const cats = allCategories.filter(c =>
          report.categories.some(rc => rc.id === c.id),
        );
        setSelectedCategories(cats);
        const color = report.color || cats[0]?.color || '';
        if (color) colorSetRef.current = true;
        reset({
          title: report.title || '',
          description: report.description || '',
          color,
          categoryIds: cats.map(c => c.id),
        });
      } else {
        setSelectedCategories([]);
        reset({ title: '', description: '', color: '', categoryIds: [] });
      }
    }
  }, [open, report, allCategories, reset]);

  const handleFormSubmit = (data: TrendReportFormData) => {
    onSubmit(data);
  };

  const handleClose = () => {
    if (!isLoading) onClose();
  };

  const selectAllOption: Category = {
    id: SELECT_ALL_ID,
    userId: 0,
    name: t('SELECT_ALL'),
    type: CategoryType.EXPENSE,
  };

  const options: Category[] = [selectAllOption, ...allCategories];

  const handleAutocompleteChange = (_: unknown, value: Category[]) => {
    const hasSelectAll = value.some(v => v.id === SELECT_ALL_ID);
    if (hasSelectAll) {
      if (selectedCategories.length === allCategories.length) {
        setSelectedCategories([]);
        setValue('categoryIds', [], { shouldValidate: true });
      } else {
        setSelectedCategories(allCategories);
        setValue('categoryIds', allCategories.map(c => c.id), { shouldValidate: true });
      }
    } else {
      const filtered = value.filter(v => v.id !== SELECT_ALL_ID);
      setSelectedCategories(filtered);
      setValue('categoryIds', filtered.map(c => c.id), { shouldValidate: true });
      if (filtered.length > 0 && !colorSetRef.current) {
        const firstColor = filtered[0].color || '';
        if (firstColor) {
          setValue('color', firstColor);
          colorSetRef.current = true;
        }
      }
    }
  };

  const allSelected = selectedCategories.length === allCategories.length;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      id="trend-report-dialog"
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        {report ? t('EDIT_TREND_REPORT') : t('NEW_TREND_REPORT')}
      </DialogTitle>

      <DialogContent className="dialog-content">
        <form id="trend-report-form" onSubmit={handleSubmit(handleFormSubmit)}>
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('TREND_REPORT_TITLE')}
                fullWidth
                autoFocus
                placeholder={t('TREND_REPORT_TITLE_PLACEHOLDER')}
              />
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('TREND_REPORT_DESCRIPTION')}
                fullWidth
                multiline
                rows={2}
                placeholder={t('TREND_REPORT_DESCRIPTION_PLACEHOLDER')}
              />
            )}
          />

          <Autocomplete
            multiple
            options={options}
            value={selectedCategories}
            onChange={handleAutocompleteChange}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            disableCloseOnSelect
            renderOption={(props, option) => {
              const { key, ...rest } = props as { key: React.Key } & React.HTMLAttributes<HTMLLIElement>;
              if (option.id === SELECT_ALL_ID) {
                return (
                  <li key={key} {...rest}>
                    <Checkbox checked={allSelected} indeterminate={selectedCategories.length > 0 && !allSelected}/>
                    <span>{t('SELECT_ALL')}</span>
                  </li>
                );
              }
              return (
                <li key={key} {...rest}>
                  <Checkbox checked={selectedCategories.some(c => c.id === option.id)}/>
                  {option.color && (
                    <Box
                      component="span"
                      className="category-color-dot"
                      sx={{ backgroundColor: option.color }}
                    />
                  )}
                  <span>{option.name}</span>
                </li>
              );
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={option.name}
                    size="small"
                    {...tagProps}
                    sx={option.color ? { borderLeft: `3px solid ${option.color}` } : undefined}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('TREND_REPORT_CATEGORIES')}
                error={!!errors.categoryIds}
                helperText={errors.categoryIds ? t(errors.categoryIds.message || '') : ''}
              />
            )}
          />

          {/* Hidden controller to keep react-hook-form in sync */}
          <Controller
            name="categoryIds"
            control={control}
            render={() => <input type="hidden" value={watchedCategoryIds.join(',')}/>}
          />

          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="color"
                label={t('TREND_REPORT_COLOR')}
                fullWidth
                error={!!errors.color}
                helperText={errors.color ? t(errors.color.message || '') : ''}
                className="color-field"
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
          form="trend-report-form"
          variant="contained"
          color="primary"
          disabled={isLoading}
          className="submit-button"
        >
          {isLoading ? (
            <CircularProgress size={24}/>
          ) : report ? (
            t('UPDATE')
          ) : (
            t('CREATE')
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TrendReportDialog;
