import './empty-state.scss';
import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

interface EmptyStateProps {
  title: string;
  message?: string;
  actions?: ReactNode;
}

function EmptyState({ title, message, actions }: EmptyStateProps) {
  return (
    <Stack gap={1} className="shared-empty-state">
      <Typography variant="h6" color="text.primary" fontWeight="bold">{title}</Typography>
      {message && <Typography variant="body2" className="shared-empty-state-message">{message}</Typography>}
      {actions && <Stack direction="row" gap={1} justifyContent="center" flexWrap="wrap" className="shared-empty-state-actions">{actions}</Stack>}
    </Stack>
  );
}

export default EmptyState;
