import { Box, Chip, Stack, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePaymentMethods } from '../../services/paymentMethodService';

interface PaymentMethodFilterProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

function PaymentMethodFilter({ selectedIds, onChange }: PaymentMethodFilterProps) {
  const { t } = useTranslation();
  const { data: paymentMethods, isLoading } = usePaymentMethods();

  const handleToggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  if (isLoading) {
    return (
      <Box>
        <Stack direction="row" gap={1}>
          <Skeleton variant="rounded" width={120} height={32} />
          <Skeleton variant="rounded" width={80} height={32} />
          <Skeleton variant="rounded" width={100} height={32} />
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Chip
          label={t('ALL_PAYMENT_METHODS')}
          onClick={handleSelectAll}
          color={selectedIds.length === 0 ? 'primary' : 'default'}
          variant={selectedIds.length === 0 ? 'filled' : 'outlined'}
        />
        {paymentMethods?.map((pm) => (
          <Chip
            key={pm.id}
            label={pm.name}
            onClick={() => handleToggle(pm.id)}
            color={selectedIds.includes(pm.id) ? 'primary' : 'default'}
            variant={selectedIds.includes(pm.id) ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>
    </Box>
  );
}

export default PaymentMethodFilter;
