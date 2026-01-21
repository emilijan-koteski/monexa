import './categories-page.scss';
import { useState } from 'react';
import { Box, Button, Chip, CircularProgress, Container, IconButton, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faEdit, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '../../../services/categoryService';
import type { Category } from '../../../types/models';
import { CategoryType } from '../../../enums/CategoryType';
import { toast } from 'react-toastify';
import CategoryDialog, { type CategoryFormData } from '../../../components/category-dialog/CategoryDialog';
import ConfirmationDialog from '../../../components/confirmation-dialog/ConfirmationDialog';

const CategoriesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: categories, isLoading } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const handleBack = () => {
    navigate('/settings');
  };

  const handleNewCategory = () => {
    setSelectedCategory(null);
    setDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setDialogOpen(true);
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedCategory(null);
  };

  const handleDialogSubmit = async (data: CategoryFormData) => {
    try {
      if (selectedCategory) {
        await updateMutation.mutateAsync({
          id: selectedCategory.id,
          data: {
            name: data.name,
            type: data.type,
            description: data.description,
            color: data.color,
          },
        });
        toast.success(t('CATEGORY_UPDATED_SUCCESS'));
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          type: data.type,
          description: data.description,
          color: data.color,
        });
        toast.success(t('CATEGORY_CREATED_SUCCESS'));
      }

      handleDialogClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t('CATEGORY_SAVE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    try {
      await deleteMutation.mutateAsync(categoryToDelete.id);
      toast.success(t('CATEGORY_DELETED_SUCCESS'));
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t('CATEGORY_DELETE_ERROR');
      toast.error(errorMessage);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const isAnyMutationLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <>
      <Container maxWidth="md" id="categories-page">
        <Box className="page-header">
          <IconButton
            color="primary"
            onClick={handleBack}
            className="back-button"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </IconButton>
          <Typography
            variant="h5"
            color="text.primary"
            fontWeight="600"
            className="page-title"
          >
            {t('CATEGORIES')}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNewCategory}
            className="add-button"
            startIcon={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('NEW')}
          </Button>
        </Box>

        {isLoading ? (
          <Box className="loading-container">
            <CircularProgress />
          </Box>
        ) : categories && categories.length > 0 ? (
          <List className="category-list">
            {categories.map((category) => (
              <ListItem
                key={category.id}
                disablePadding
                className="category-list-item"
              >
                <Box className="category-item">
                  <Box className="category-info">
                    {category.color && (
                      <Box
                        className="category-color-indicator"
                        sx={{ backgroundColor: category.color }}
                      />
                    )}
                    <Box className="category-details">
                      <ListItemText
                        primary={category.name}
                        secondary={category.description}
                        className="category-text"
                      />
                      <Chip
                        label={t(category.type)}
                        size="small"
                        color={category.type === CategoryType.INCOME ? 'success' : 'error'}
                        className="category-type-chip"
                      />
                    </Box>
                  </Box>
                  <Box className="action-buttons">
                    <IconButton
                      color="secondary"
                      size="large"
                      onClick={() => handleEditCategory(category)}
                      disabled={isAnyMutationLoading}
                    >
                      <FontAwesomeIcon icon={faEdit} fontSize="medium" />
                    </IconButton>
                    <IconButton
                      color="error"
                      size="large"
                      onClick={() => handleDeleteClick(category)}
                      disabled={isAnyMutationLoading}
                    >
                      <FontAwesomeIcon icon={faTrash} fontSize='medium' />
                    </IconButton>
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        ) : (
          <Stack gap={1} className="empty-state">
            <Typography variant="h6" color="text.primary" fontWeight="bold">
              {t('NO_CATEGORIES_TITLE')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('NO_CATEGORIES_MESSAGE')}
            </Typography>
          </Stack>
        )}
      </Container>

      <CategoryDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
        category={selectedCategory}
        isLoading={isAnyMutationLoading}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
        title="DELETE_CATEGORY_TITLE"
        message="DELETE_CATEGORY_MESSAGE"
        confirmText="DELETE"
        confirmColor="error"
      />
    </>
  );
};

export default CategoriesPage;
