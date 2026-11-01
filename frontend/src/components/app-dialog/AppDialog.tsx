import { Dialog, type DialogProps } from '@mui/material';
import { useBackToClose } from '../../navigation/useBackToClose';

/** MUI Dialog that the phone's back gesture closes, the same way the Escape key does. */
function AppDialog(props: DialogProps) {
  const { open, onClose } = props;
  useBackToClose(open, () => onClose?.({}, 'escapeKeyDown'));
  return <Dialog {...props} />;
}

export default AppDialog;
