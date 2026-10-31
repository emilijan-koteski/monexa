package services

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	dtoResponses "github.com/emilijan-koteski/monexa/internal/responses"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
)

const (
	maxGroupMembers      = 30
	maxGroupNameLength   = 60
	maxDisplayNameLength = 40
	defaultGroupIcon     = "city"
	defaultGroupColor    = "#ff7aa8"
	inviteCodeAttempts   = 5
)

var (
	groupIcons = map[string]bool{
		"city": true, "plane": true, "mountain": true, "sun": true, "home": true, "utensils": true,
		"car": true, "tent": true, "gift": true, "briefcase": true, "heart": true, "ship": true,
	}
	hexColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
)

type GroupService struct {
	db *gorm.DB
}

func NewGroupService(db *gorm.DB) *GroupService {
	return &GroupService{db: db}
}

// lockGroupRow serializes writes to one group and returns ErrGroupNotFound for a missing or deleted group.
func lockGroupRow(tx *gorm.DB, groupID uint) (*models.Group, error) {
	var groups []models.Group
	if err := tx.Raw("SELECT * FROM groups WHERE id = ? AND deleted_at IS NULL FOR NO KEY UPDATE", groupID).Scan(&groups).Error; err != nil {
		return nil, fmt.Errorf("failed to lock group: %w", err)
	}
	if len(groups) == 0 {
		return nil, ErrGroupNotFound
	}
	return &groups[0], nil
}

// findMembership returns the caller's member row, or ErrGroupNotFound so non-members cannot tell whether a group exists.
func findMembership(tx *gorm.DB, groupID, userID uint) (*models.GroupMember, error) {
	var member models.GroupMember
	err := tx.Model(&models.GroupMember{}).
		Joins("JOIN groups ON groups.id = group_members.group_id AND groups.deleted_at IS NULL").
		Where("group_members.group_id = ? AND group_members.user_id = ?", groupID, userID).
		First(&member).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrGroupNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to check membership: %w", err)
	}
	return &member, nil
}

// withLockedGroup runs fn in a transaction that holds the group lock and has re-checked the caller's membership.
func withLockedGroup(ctx context.Context, db *gorm.DB, groupID, userID uint, fn func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error) error {
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		group, err := lockGroupRow(tx, groupID)
		if err != nil {
			return err
		}
		me, err := findMembership(tx, groupID, userID)
		if err != nil {
			return err
		}
		return fn(tx, group, me)
	})
}

func requireOwner(me *models.GroupMember) error {
	if me.Role != types.GroupOwner {
		return ErrGroupForbidden
	}
	return nil
}

func requireActive(group *models.Group) error {
	if group.ArchivedAt != nil {
		return ErrGroupArchived
	}
	return nil
}

func validationError(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrGroupValidation, fmt.Sprintf(format, args...))
}

func cleanName(value, label string, maxLength int) (string, error) {
	name := strings.Join(strings.Fields(value), " ")
	if name == "" || utf8.RuneCountInString(name) > maxLength {
		return "", validationError("%s must be 1 to %d characters", label, maxLength)
	}
	return name, nil
}

func parseOptionalDay(value *string) (*time.Time, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	day, err := utils.ParseDay(strings.TrimSpace(*value))
	if err != nil {
		return nil, validationError("%s", err.Error())
	}
	return &day, nil
}

func loadMembers(tx *gorm.DB, groupID uint) ([]models.GroupMember, error) {
	var members []models.GroupMember
	if err := tx.Where("group_id = ?", groupID).Order("id").Find(&members).Error; err != nil {
		return nil, fmt.Errorf("failed to load members: %w", err)
	}
	return members, nil
}

func ensureDisplayNameFree(tx *gorm.DB, groupID uint, name string, exceptMemberID uint) error {
	var count int64
	if err := tx.Model(&models.GroupMember{}).
		Where("group_id = ? AND lower(display_name) = lower(?) AND id <> ?", groupID, name, exceptMemberID).
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check name: %w", err)
	}
	if count > 0 {
		return ErrDisplayNameTaken
	}
	return nil
}

func ensureRoomForMember(tx *gorm.DB, groupID uint) error {
	var count int64
	if err := tx.Model(&models.GroupMember{}).Where("group_id = ?", groupID).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to count members: %w", err)
	}
	if count >= maxGroupMembers {
		return ErrGroupMemberLimit
	}
	return nil
}

func groupHasActivity(tx *gorm.DB, groupID uint) (bool, error) {
	var found bool
	err := tx.Raw(`SELECT EXISTS(SELECT 1 FROM group_expenses WHERE group_id = ? AND deleted_at IS NULL)
		OR EXISTS(SELECT 1 FROM group_settlements WHERE group_id = ? AND deleted_at IS NULL)`, groupID, groupID).Scan(&found).Error
	if err != nil {
		return false, fmt.Errorf("failed to check group activity: %w", err)
	}
	return found, nil
}

func memberHasActivity(tx *gorm.DB, memberID uint) (bool, error) {
	var found bool
	err := tx.Raw(`SELECT EXISTS(SELECT 1 FROM group_expenses WHERE paid_by_member_id = ? AND deleted_at IS NULL)
		OR EXISTS(SELECT 1 FROM group_expense_shares s JOIN group_expenses e ON e.id = s.expense_id AND e.deleted_at IS NULL WHERE s.member_id = ?)
		OR EXISTS(SELECT 1 FROM group_settlements WHERE deleted_at IS NULL AND (from_member_id = ? OR to_member_id = ?))`,
		memberID, memberID, memberID, memberID).Scan(&found).Error
	if err != nil {
		return false, fmt.Errorf("failed to check member activity: %w", err)
	}
	return found, nil
}

func generateUniqueInviteCode(tx *gorm.DB) (string, error) {
	for attempt := 0; attempt < inviteCodeAttempts; attempt++ {
		code, err := utils.GenerateInviteCode()
		if err != nil {
			return "", fmt.Errorf("failed to generate invite code: %w", err)
		}
		var count int64
		if err := tx.Unscoped().Model(&models.Group{}).Where("invite_code = ?", code).Count(&count).Error; err != nil {
			return "", fmt.Errorf("failed to check invite code: %w", err)
		}
		if count == 0 {
			return code, nil
		}
	}
	return "", errors.New("failed to generate a unique invite code")
}

func loadUserName(tx *gorm.DB, userID uint) (string, error) {
	var user models.User
	if err := tx.Select("id", "name").First(&user, userID).Error; err != nil {
		return "", fmt.Errorf("failed to load user: %w", err)
	}
	return user.Name, nil
}

func toMemberResponses(members []models.GroupMember, userID uint) []dtoResponses.GroupMemberResponse {
	out := make([]dtoResponses.GroupMemberResponse, 0, len(members))
	for _, m := range members {
		if m.DeletedAt.Valid {
			continue
		}
		out = append(out, dtoResponses.GroupMemberResponse{
			ID:          m.ID,
			DisplayName: m.DisplayName,
			Role:        m.Role,
			IsLinked:    m.UserID != nil,
			IsMe:        m.UserID != nil && *m.UserID == userID,
			LinkedAt:    m.LinkedAt,
		})
	}
	return out
}

func (s *GroupService) buildGroupResponse(tx *gorm.DB, group *models.Group, me *models.GroupMember, userID uint) (*dtoResponses.GroupResponse, error) {
	members, err := loadMembers(tx, group.ID)
	if err != nil {
		return nil, err
	}
	hasActivity, err := groupHasActivity(tx, group.ID)
	if err != nil {
		return nil, err
	}
	synced, kept, err := countGroupRecords(tx, group.ID, userID)
	if err != nil {
		return nil, err
	}

	var invite *string
	if group.InviteCode != nil {
		formatted := utils.FormatInviteCode(*group.InviteCode)
		invite = &formatted
	}

	return &dtoResponses.GroupResponse{
		ID:            group.ID,
		CreatedAt:     group.CreatedAt,
		Name:          group.Name,
		Icon:          group.Icon,
		Color:         group.Color,
		BaseCurrency:  group.BaseCurrency,
		StartDate:     group.StartDate,
		EndDate:       group.EndDate,
		SimplifyDebts: group.SimplifyDebts,
		ArchivedAt:    group.ArchivedAt,
		InviteCode:    invite,
		HasActivity:   hasActivity,
		Members:       toMemberResponses(members, userID),
		Me: dtoResponses.GroupMembershipResponse{
			MemberID:            me.ID,
			Role:                me.Role,
			SyncEnabled:         me.SyncEnabled,
			SyncCategoryID:      me.SyncCategoryID,
			SyncPaymentMethodID: me.SyncPaymentMethodID,
			SyncedRecordCount:   synced,
			KeptRecordCount:     kept,
		},
	}, nil
}

func (s *GroupService) List(ctx context.Context, userID uint) ([]dtoResponses.GroupSummaryResponse, error) {
	db := s.db.WithContext(ctx)
	var memberships []models.GroupMember
	if err := db.Model(&models.GroupMember{}).
		Joins("JOIN groups ON groups.id = group_members.group_id AND groups.deleted_at IS NULL").
		Where("group_members.user_id = ?", userID).
		Order("group_members.group_id DESC").
		Find(&memberships).Error; err != nil {
		return nil, fmt.Errorf("failed to load groups: %w", err)
	}

	out := make([]dtoResponses.GroupSummaryResponse, 0, len(memberships))
	for _, membership := range memberships {
		var group models.Group
		if err := db.First(&group, membership.GroupID).Error; err != nil {
			return nil, fmt.Errorf("failed to load group: %w", err)
		}
		ledger, err := loadGroupLedger(db, &group)
		if err != nil {
			return nil, err
		}
		sheet := computeBalances(ledger)
		myNet := roundToSettled(sheet.Net[membership.ID], settleThreshold(group.BaseCurrency))
		out = append(out, dtoResponses.GroupSummaryResponse{
			ID:           group.ID,
			Name:         group.Name,
			Icon:         group.Icon,
			Color:        group.Color,
			BaseCurrency: group.BaseCurrency,
			StartDate:    group.StartDate,
			EndDate:      group.EndDate,
			ArchivedAt:   group.ArchivedAt,
			Members:      toMemberResponses(ledger.Members, userID),
			MyNet:        utils.FromCents(myNet),
			PendingCount: sheet.PendingCount,
			ExpenseCount: sheet.ExpenseCount,
		})
	}
	return out, nil
}

func (s *GroupService) Get(ctx context.Context, groupID, userID uint) (*dtoResponses.GroupResponse, error) {
	db := s.db.WithContext(ctx)
	me, err := findMembership(db, groupID, userID)
	if err != nil {
		return nil, err
	}
	var group models.Group
	if err := db.First(&group, groupID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrGroupNotFound
		}
		return nil, fmt.Errorf("failed to load group: %w", err)
	}
	return s.buildGroupResponse(db, &group, me, userID)
}

func (s *GroupService) Create(ctx context.Context, userID uint, req requests.GroupRequest) (*dtoResponses.GroupResponse, error) {
	var groupID uint
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		group, err := newGroupFromRequest(tx, userID, req)
		if err != nil {
			return err
		}
		ownerName, err := loadUserName(tx, userID)
		if err != nil {
			return err
		}
		ownerName, err = cleanName(ownerName, "your name", maxDisplayNameLength)
		if err != nil {
			return err
		}
		guests, err := cleanGuestNames(req.GuestNames, ownerName)
		if err != nil {
			return err
		}

		if err := tx.Create(group).Error; err != nil {
			return fmt.Errorf("failed to create group: %w", err)
		}
		now := time.Now()
		owner := models.GroupMember{GroupID: group.ID, UserID: &userID, DisplayName: ownerName, Role: types.GroupOwner, LinkedAt: &now}
		if err := tx.Create(&owner).Error; err != nil {
			return fmt.Errorf("failed to add owner: %w", err)
		}
		for _, name := range guests {
			guest := models.GroupMember{GroupID: group.ID, DisplayName: name, Role: types.GroupMember}
			if err := tx.Create(&guest).Error; err != nil {
				return fmt.Errorf("failed to add %s: %w", name, err)
			}
		}
		groupID = group.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, groupID, userID)
}

func newGroupFromRequest(tx *gorm.DB, userID uint, req requests.GroupRequest) (*models.Group, error) {
	if req.Name == nil {
		return nil, validationError("name is required")
	}
	name, err := cleanName(*req.Name, "name", maxGroupNameLength)
	if err != nil {
		return nil, err
	}
	icon := defaultGroupIcon
	if req.Icon != nil {
		if !groupIcons[*req.Icon] {
			return nil, validationError("unknown icon")
		}
		icon = *req.Icon
	}
	color := defaultGroupColor
	if req.Color != nil {
		if !hexColorPattern.MatchString(*req.Color) {
			return nil, validationError("color must look like #a1b2c3")
		}
		color = strings.ToLower(*req.Color)
	}
	currency := types.MacedonianDenar
	if req.BaseCurrency != nil {
		currency = *req.BaseCurrency
	} else {
		var preferred []types.CurrencyType
		if err := tx.Model(&models.Setting{}).Where("user_id = ?", userID).Limit(1).Pluck("currency", &preferred).Error; err != nil {
			return nil, fmt.Errorf("failed to read settings: %w", err)
		}
		if len(preferred) > 0 {
			currency = preferred[0]
		}
	}
	if !types.IsValidCurrencyType(currency) {
		return nil, validationError("unsupported currency")
	}
	start, err := parseOptionalDay(req.StartDate)
	if err != nil {
		return nil, err
	}
	end, err := parseOptionalDay(req.EndDate)
	if err != nil {
		return nil, err
	}
	if start != nil && end != nil && end.Before(*start) {
		return nil, validationError("the end date is before the start date")
	}
	code, err := generateUniqueInviteCode(tx)
	if err != nil {
		return nil, err
	}
	return &models.Group{
		Name:          name,
		Icon:          icon,
		Color:         color,
		BaseCurrency:  currency,
		StartDate:     start,
		EndDate:       end,
		SimplifyDebts: true,
		InviteCode:    &code,
	}, nil
}

func cleanGuestNames(raw []string, ownerName string) ([]string, error) {
	seen := map[string]bool{strings.ToLower(ownerName): true}
	var names []string
	for _, value := range raw {
		if strings.TrimSpace(value) == "" {
			continue
		}
		name, err := cleanName(value, "a name", maxDisplayNameLength)
		if err != nil {
			return nil, err
		}
		key := strings.ToLower(name)
		if seen[key] {
			return nil, ErrDisplayNameTaken
		}
		seen[key] = true
		names = append(names, name)
	}
	if len(names)+1 > maxGroupMembers {
		return nil, ErrGroupMemberLimit
	}
	return names, nil
}

func (s *GroupService) Update(ctx context.Context, groupID, userID uint, req requests.GroupRequest) (*dtoResponses.GroupResponse, error) {
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		ownerFields := req.Name != nil || req.Icon != nil || req.Color != nil || req.BaseCurrency != nil ||
			req.StartDate != nil || req.EndDate != nil || req.Archived != nil
		if ownerFields {
			if err := requireOwner(me); err != nil {
				return err
			}
		}
		updates, err := groupUpdates(tx, group, req)
		if err != nil {
			return err
		}
		if len(updates) == 0 {
			return nil
		}
		if err := tx.Model(&models.Group{ID: group.ID}).Updates(updates).Error; err != nil {
			return fmt.Errorf("failed to update group: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, groupID, userID)
}

func groupUpdates(tx *gorm.DB, group *models.Group, req requests.GroupRequest) (map[string]any, error) {
	updates := map[string]any{}
	if req.Name != nil {
		name, err := cleanName(*req.Name, "name", maxGroupNameLength)
		if err != nil {
			return nil, err
		}
		updates["name"] = name
	}
	if req.Icon != nil {
		if !groupIcons[*req.Icon] {
			return nil, validationError("unknown icon")
		}
		updates["icon"] = *req.Icon
	}
	if req.Color != nil {
		if !hexColorPattern.MatchString(*req.Color) {
			return nil, validationError("color must look like #a1b2c3")
		}
		updates["color"] = strings.ToLower(*req.Color)
	}
	if req.BaseCurrency != nil && *req.BaseCurrency != group.BaseCurrency {
		if !types.IsValidCurrencyType(*req.BaseCurrency) {
			return nil, validationError("unsupported currency")
		}
		active, err := groupHasActivity(tx, group.ID)
		if err != nil {
			return nil, err
		}
		if active {
			return nil, ErrBaseCurrencyLocked
		}
		updates["base_currency"] = *req.BaseCurrency
	}
	start, end := group.StartDate, group.EndDate
	if req.StartDate != nil {
		day, err := parseOptionalDay(req.StartDate)
		if err != nil {
			return nil, err
		}
		start = day
		updates["start_date"] = day
	}
	if req.EndDate != nil {
		day, err := parseOptionalDay(req.EndDate)
		if err != nil {
			return nil, err
		}
		end = day
		updates["end_date"] = day
	}
	if start != nil && end != nil && end.Before(*start) {
		return nil, validationError("the end date is before the start date")
	}
	if req.SimplifyDebts != nil {
		updates["simplify_debts"] = *req.SimplifyDebts
	}
	if req.Archived != nil {
		switch {
		case *req.Archived && group.ArchivedAt == nil:
			updates["archived_at"] = time.Now()
		case !*req.Archived && group.ArchivedAt != nil:
			updates["archived_at"] = nil
		}
	}
	return updates, nil
}

func (s *GroupService) Delete(ctx context.Context, groupID, userID uint) error {
	return withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireOwner(me); err != nil {
			return err
		}
		if err := detachGroupRecordsTx(tx, group.ID, nil); err != nil {
			return err
		}
		if err := tx.Model(&models.Group{ID: group.ID}).Update("invite_code", nil).Error; err != nil {
			return fmt.Errorf("failed to clear invite code: %w", err)
		}
		if err := tx.Delete(&models.Group{ID: group.ID}).Error; err != nil {
			return fmt.Errorf("failed to delete group: %w", err)
		}
		return nil
	})
}

func (s *GroupService) RegenerateInvite(ctx context.Context, groupID, userID uint) (*dtoResponses.GroupResponse, error) {
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireOwner(me); err != nil {
			return err
		}
		code, err := generateUniqueInviteCode(tx)
		if err != nil {
			return err
		}
		return tx.Model(&models.Group{ID: group.ID}).Update("invite_code", code).Error
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, groupID, userID)
}

func (s *GroupService) DisableInvite(ctx context.Context, groupID, userID uint) (*dtoResponses.GroupResponse, error) {
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireOwner(me); err != nil {
			return err
		}
		return tx.Model(&models.Group{ID: group.ID}).Update("invite_code", nil).Error
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, groupID, userID)
}

func findGroupByInvite(tx *gorm.DB, code string) (*models.Group, string, error) {
	normalized := utils.NormalizeInviteCode(code)
	if len(normalized) != 8 {
		return nil, "", ErrInviteInvalid
	}
	var group models.Group
	err := tx.Where("invite_code = ? AND archived_at IS NULL", normalized).First(&group).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, "", ErrInviteInvalid
	}
	if err != nil {
		return nil, "", fmt.Errorf("failed to find invite: %w", err)
	}
	return &group, normalized, nil
}

func (s *GroupService) JoinPreview(ctx context.Context, code string, userID uint) (*dtoResponses.GroupJoinPreviewResponse, error) {
	db := s.db.WithContext(ctx)
	group, _, err := findGroupByInvite(db, code)
	if err != nil {
		return nil, err
	}
	members, err := loadMembers(db, group.ID)
	if err != nil {
		return nil, err
	}
	name, err := loadUserName(db, userID)
	if err != nil {
		return nil, err
	}
	preview := &dtoResponses.GroupJoinPreviewResponse{
		GroupID:       group.ID,
		Name:          group.Name,
		Icon:          group.Icon,
		Color:         group.Color,
		BaseCurrency:  group.BaseCurrency,
		StartDate:     group.StartDate,
		EndDate:       group.EndDate,
		MemberCount:   len(members),
		Guests:        []dtoResponses.GroupJoinGuestResponse{},
		SuggestedName: name,
	}
	for _, m := range members {
		if m.UserID == nil {
			preview.Guests = append(preview.Guests, dtoResponses.GroupJoinGuestResponse{ID: m.ID, DisplayName: m.DisplayName})
		} else if *m.UserID == userID {
			preview.AlreadyMember = true
		}
	}
	return preview, nil
}

func (s *GroupService) Join(ctx context.Context, code string, userID uint, req requests.GroupJoinRequest) (*dtoResponses.GroupJoinResponse, error) {
	var result dtoResponses.GroupJoinResponse
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		found, normalized, err := findGroupByInvite(tx, code)
		if err != nil {
			return err
		}
		group, err := lockGroupRow(tx, found.ID)
		if err != nil {
			return err
		}
		if group.InviteCode == nil || *group.InviteCode != normalized || group.ArchivedAt != nil {
			return ErrInviteInvalid
		}
		if _, err := findMembership(tx, group.ID, userID); err == nil {
			return ErrAlreadyMember
		} else if !errors.Is(err, ErrGroupNotFound) {
			return err
		}

		now := time.Now()
		if req.MemberID != nil {
			var guest models.GroupMember
			if err := tx.Where("id = ? AND group_id = ?", *req.MemberID, group.ID).First(&guest).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrMemberNotFound
				}
				return fmt.Errorf("failed to load member: %w", err)
			}
			if guest.UserID != nil {
				return ErrGuestAlreadyClaimed
			}
			if err := tx.Model(&guest).Updates(map[string]any{"user_id": userID, "linked_at": now}).Error; err != nil {
				return fmt.Errorf("failed to link member: %w", err)
			}
			result = dtoResponses.GroupJoinResponse{GroupID: group.ID, MemberID: guest.ID}
			return nil
		}

		if err := ensureRoomForMember(tx, group.ID); err != nil {
			return err
		}
		name := ""
		if req.DisplayName != nil {
			name = *req.DisplayName
		} else if name, err = loadUserName(tx, userID); err != nil {
			return err
		}
		name, err = cleanName(name, "your name", maxDisplayNameLength)
		if err != nil {
			return err
		}
		if err := ensureDisplayNameFree(tx, group.ID, name, 0); err != nil {
			return err
		}
		member := models.GroupMember{GroupID: group.ID, UserID: &userID, DisplayName: name, Role: types.GroupMember, LinkedAt: &now}
		if err := tx.Create(&member).Error; err != nil {
			return fmt.Errorf("failed to join group: %w", err)
		}
		result = dtoResponses.GroupJoinResponse{GroupID: group.ID, MemberID: member.ID}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func findGroupMember(tx *gorm.DB, groupID, memberID uint) (*models.GroupMember, error) {
	var member models.GroupMember
	err := tx.Where("id = ? AND group_id = ?", memberID, groupID).First(&member).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrMemberNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load member: %w", err)
	}
	return &member, nil
}

func (s *GroupService) AddMember(ctx context.Context, groupID, userID uint, req requests.GroupMemberRequest) (*dtoResponses.GroupResponse, error) {
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireOwner(me); err != nil {
			return err
		}
		if err := requireActive(group); err != nil {
			return err
		}
		if req.DisplayName == nil {
			return validationError("name is required")
		}
		name, err := cleanName(*req.DisplayName, "name", maxDisplayNameLength)
		if err != nil {
			return err
		}
		if err := ensureRoomForMember(tx, group.ID); err != nil {
			return err
		}
		if err := ensureDisplayNameFree(tx, group.ID, name, 0); err != nil {
			return err
		}
		guest := models.GroupMember{GroupID: group.ID, DisplayName: name, Role: types.GroupMember}
		return tx.Create(&guest).Error
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, groupID, userID)
}

func (s *GroupService) UpdateMember(ctx context.Context, groupID, memberID, userID uint, req requests.GroupMemberRequest) (*dtoResponses.GroupResponse, error) {
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireOwner(me); err != nil {
			return err
		}
		target, err := findGroupMember(tx, group.ID, memberID)
		if err != nil {
			return err
		}
		if req.DisplayName != nil {
			name, err := cleanName(*req.DisplayName, "name", maxDisplayNameLength)
			if err != nil {
				return err
			}
			if err := ensureDisplayNameFree(tx, group.ID, name, target.ID); err != nil {
				return err
			}
			if err := tx.Model(target).Update("display_name", name).Error; err != nil {
				return fmt.Errorf("failed to rename member: %w", err)
			}
		}
		if req.Role != nil && *req.Role == types.GroupOwner && target.ID != me.ID {
			if target.UserID == nil {
				return validationError("only a person with a linked account can own the group")
			}
			if err := tx.Model(target).Update("role", types.GroupOwner).Error; err != nil {
				return fmt.Errorf("failed to transfer ownership: %w", err)
			}
			if err := tx.Model(me).Update("role", types.GroupMember).Error; err != nil {
				return fmt.Errorf("failed to transfer ownership: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, groupID, userID)
}

func (s *GroupService) RemoveMember(ctx context.Context, groupID, memberID, userID uint) (*dtoResponses.GroupResponse, error) {
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireOwner(me); err != nil {
			return err
		}
		target, err := findGroupMember(tx, group.ID, memberID)
		if err != nil {
			return err
		}
		if target.Role == types.GroupOwner {
			return validationError("the owner cannot be removed")
		}
		active, err := memberHasActivity(tx, target.ID)
		if err != nil {
			return err
		}
		if active {
			return ErrMemberHasActivity
		}
		if target.UserID != nil {
			if err := detachGroupRecordsTx(tx, group.ID, target.UserID); err != nil {
				return err
			}
		}
		return tx.Delete(target).Error
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, groupID, userID)
}

func unlinkMemberTx(tx *gorm.DB, member *models.GroupMember) error {
	return tx.Model(member).Updates(map[string]any{
		"user_id":                nil,
		"linked_at":              nil,
		"role":                   types.GroupMember,
		"sync_enabled":           false,
		"sync_category_id":       nil,
		"sync_payment_method_id": nil,
	}).Error
}

func (s *GroupService) UnlinkMember(ctx context.Context, groupID, memberID, userID uint) (*dtoResponses.GroupResponse, error) {
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireOwner(me); err != nil {
			return err
		}
		target, err := findGroupMember(tx, group.ID, memberID)
		if err != nil {
			return err
		}
		if target.ID == me.ID {
			return validationError("use leave group to unlink yourself")
		}
		if target.UserID == nil {
			return validationError("this person has no linked account")
		}
		if err := detachGroupRecordsTx(tx, group.ID, target.UserID); err != nil {
			return err
		}
		return unlinkMemberTx(tx, target)
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, groupID, userID)
}

// handOverOwnership makes the earliest-linked other member the owner; it fails when nobody else has a linked account.
func handOverOwnership(tx *gorm.DB, groupID, leavingMemberID uint) error {
	var next models.GroupMember
	err := tx.Where("group_id = ? AND id <> ? AND user_id IS NOT NULL", groupID, leavingMemberID).
		Order("linked_at ASC, id ASC").
		First(&next).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrOwnerMustTransfer
	}
	if err != nil {
		return fmt.Errorf("failed to find the next owner: %w", err)
	}
	return tx.Model(&next).Update("role", types.GroupOwner).Error
}

func (s *GroupService) Leave(ctx context.Context, groupID, userID uint, keepRecords bool) error {
	return withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if me.Role == types.GroupOwner {
			if err := handOverOwnership(tx, group.ID, me.ID); err != nil {
				return err
			}
		}
		if !keepRecords {
			if err := removeSyncedRecordsTx(tx, group.ID, userID); err != nil {
				return err
			}
		}
		if err := detachGroupRecordsTx(tx, group.ID, &userID); err != nil {
			return err
		}
		return unlinkMemberTx(tx, me)
	})
}
