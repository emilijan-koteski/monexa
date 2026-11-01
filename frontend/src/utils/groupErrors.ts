import type { TFunction } from 'i18next';
import { GroupRequestError } from '../services/groupService';

const MESSAGE_KEYS: Record<string, string> = {
  'someone in the group already has this name': 'GROUP_ERROR_NAME_TAKEN',
  'the group currency can change only before the first expense or payment': 'GROUP_ERROR_CURRENCY_LOCKED',
  'group is archived': 'GROUP_ERROR_ARCHIVED',
  'invite code is not valid': 'GROUP_ERROR_INVITE_INVALID',
  'you are already a member of this group': 'GROUP_ERROR_ALREADY_MEMBER',
  'this person is already linked to an account': 'GROUP_ERROR_GUEST_CLAIMED',
  'this person has expenses or payments in the group': 'GROUP_ERROR_MEMBER_ACTIVITY',
  'the owner can leave only when another member has a linked account': 'GROUP_ERROR_OWNER_TRANSFER',
  'a group can have at most 30 people': 'GROUP_ERROR_MEMBER_LIMIT',
  'someone else changed this expense, reload it and try again': 'GROUP_ERROR_VERSION',
  'this item cannot be ticked off': 'GROUP_ERROR_TICK',
  'this item is already ticked off': 'GROUP_ERROR_TICK',
  'invalid input: the exact amounts must add up to the total': 'GROUP_SPLIT_MUST_ADD_UP',
};

const STATUS_KEYS: Record<number, string> = {
  403: 'GROUP_ERROR_FORBIDDEN',
  404: 'GROUP_ERROR_NOT_FOUND',
  429: 'GROUP_ERROR_RATE_LIMITED',
};

/** Picks a translated message for a failed group request, falling back to the given key. */
export function groupErrorMessage(error: unknown, t: TFunction, fallbackKey: string): string {
  if (error instanceof GroupRequestError) {
    const byMessage = MESSAGE_KEYS[error.message];
    if (byMessage) {
      return t(byMessage);
    }
    const byStatus = STATUS_KEYS[error.status];
    if (byStatus) {
      return t(byStatus);
    }
  }
  return t(fallbackKey);
}
