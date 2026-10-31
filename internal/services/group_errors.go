package services

import "errors"

var (
	ErrGroupValidation      = errors.New("invalid input")
	ErrGroupNotFound        = errors.New("group not found")
	ErrGroupForbidden       = errors.New("only the group owner can do this")
	ErrGroupArchived        = errors.New("group is archived")
	ErrInviteInvalid        = errors.New("invite code is not valid")
	ErrAlreadyMember        = errors.New("you are already a member of this group")
	ErrGuestAlreadyClaimed  = errors.New("this person is already linked to an account")
	ErrMemberNotFound       = errors.New("member not found")
	ErrMemberHasActivity    = errors.New("this person has expenses or payments in the group")
	ErrBaseCurrencyLocked   = errors.New("the group currency can change only before the first expense or payment")
	ErrDisplayNameTaken     = errors.New("someone in the group already has this name")
	ErrOwnerMustTransfer    = errors.New("the owner can leave only when another member has a linked account")
	ErrGroupMemberLimit     = errors.New("a group can have at most 30 people")
	ErrExpenseNotFound      = errors.New("expense not found")
	ErrSettlementNotFound   = errors.New("payment not found")
	ErrVersionConflict      = errors.New("someone else changed this expense, reload it and try again")
	ErrShareNotTickable     = errors.New("this item cannot be ticked off")
	ErrShareAlreadyTicked   = errors.New("this item is already ticked off")
	ErrRecordManagedByGroup = errors.New("this record is synced from a shared group")
	ErrInUse                = errors.New("in use")
)
