package database

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"gorm.io/gorm"
)

var hufRsdFallbackPerEuro = map[string]float64{
	"MKD": 61.55,
	"EUR": 1,
	"USD": 1.17,
	"AUD": 1.70,
	"CHF": 0.92,
	"GBP": 0.87,
	"HUF": 390.0,
	"RSD": 117.2,
}

func isHufOrRsd(currency string) bool {
	return currency == "HUF" || currency == "RSD"
}

// migrateHufRsdFallbackRates seeds approximate rates for every pair involving HUF or RSD, derived from a frozen per-EUR table.
func migrateHufRsdFallbackRates(tx *gorm.DB) error {
	now := time.Now()
	for from, fromPerEuro := range hufRsdFallbackPerEuro {
		for to, toPerEuro := range hufRsdFallbackPerEuro {
			if from == to || (!isHufOrRsd(from) && !isHufOrRsd(to)) {
				continue
			}
			row := map[string]interface{}{
				"from_currency": from,
				"to_currency":   to,
				"rate":          toPerEuro / fromPerEuro,
				"source":        "FALLBACK",
				"fetched_at":    now,
				"created_at":    now,
			}
			if err := tx.Table("exchange_rates").Create(row).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func rollbackHufRsdFallbackRates(tx *gorm.DB) error {
	return tx.Exec(`DELETE FROM exchange_rates WHERE from_currency IN ('HUF', 'RSD') OR to_currency IN ('HUF', 'RSD')`).Error
}

func migrateCreateGroups(tx *gorm.DB) error {
	return autoMigrateWithoutForeignKeys(tx, &models.Group{})
}

func migrateCreateGroupMembers(tx *gorm.DB) error {
	if err := autoMigrateWithoutForeignKeys(tx, &models.GroupMember{}); err != nil {
		return err
	}
	return tx.Exec(`
		alter table public.group_members add constraint fk_group_members_group foreign key (group_id) references public.groups(id);
		alter table public.group_members add constraint fk_group_members_user foreign key (user_id) references public.users(id);
		alter table public.group_members add constraint fk_group_members_sync_category foreign key (sync_category_id) references public.categories(id);
		alter table public.group_members add constraint fk_group_members_sync_payment_method foreign key (sync_payment_method_id) references public.payment_methods(id);
		create unique index if not exists uniq_group_members_group_user on public.group_members (group_id, user_id) where user_id is not null and deleted_at is null;
		create unique index if not exists uniq_group_members_group_display_name on public.group_members (group_id, lower(display_name)) where deleted_at is null;
	`).Error
}

func migrateCreateGroupExpenses(tx *gorm.DB) error {
	if err := autoMigrateWithoutForeignKeys(tx, &models.GroupExpense{}); err != nil {
		return err
	}
	return tx.Exec(`
		alter table public.group_expenses add constraint fk_group_expenses_group foreign key (group_id) references public.groups(id);
		alter table public.group_expenses add constraint fk_group_expenses_paid_by foreign key (paid_by_member_id) references public.group_members(id);
		alter table public.group_expenses add constraint fk_group_expenses_created_by foreign key (created_by_member_id) references public.group_members(id);
		alter table public.group_expenses add constraint fk_group_expenses_updated_by foreign key (updated_by_member_id) references public.group_members(id);
		create unique index if not exists uniq_group_expenses_client_id on public.group_expenses (group_id, client_id) where client_id is not null;
	`).Error
}

func migrateCreateGroupExpenseShares(tx *gorm.DB) error {
	if err := autoMigrateWithoutForeignKeys(tx, &models.GroupExpenseShare{}); err != nil {
		return err
	}
	return tx.Exec(`
		alter table public.group_expense_shares add constraint fk_group_expense_shares_expense foreign key (expense_id) references public.group_expenses(id) on delete cascade;
		alter table public.group_expense_shares add constraint fk_group_expense_shares_member foreign key (member_id) references public.group_members(id);
	`).Error
}

func migrateCreateGroupSettlements(tx *gorm.DB) error {
	if err := autoMigrateWithoutForeignKeys(tx, &models.GroupSettlement{}); err != nil {
		return err
	}
	return tx.Exec(`
		alter table public.group_settlements add constraint fk_group_settlements_group foreign key (group_id) references public.groups(id);
		alter table public.group_settlements add constraint fk_group_settlements_from foreign key (from_member_id) references public.group_members(id);
		alter table public.group_settlements add constraint fk_group_settlements_to foreign key (to_member_id) references public.group_members(id);
		alter table public.group_settlements add constraint fk_group_settlements_created_by foreign key (created_by_member_id) references public.group_members(id);
		alter table public.group_settlements add constraint fk_group_settlements_share foreign key (share_id) references public.group_expense_shares(id) on delete set null;
		create unique index if not exists uniq_group_settlements_share on public.group_settlements (share_id) where share_id is not null and deleted_at is null;
		create unique index if not exists uniq_group_settlements_client_id on public.group_settlements (group_id, client_id) where client_id is not null;
	`).Error
}

// migrateAddRecordGroupColumns links personal records to the group share they were synced from.
func migrateAddRecordGroupColumns(tx *gorm.DB) error {
	for _, field := range []string{"GroupID", "GroupExpenseShareID", "GroupSyncDetachedAt"} {
		if !tx.Migrator().HasColumn(&models.Record{}, field) {
			if err := tx.Migrator().AddColumn(&models.Record{}, field); err != nil {
				return err
			}
		}
	}
	return tx.Exec(`
		create index if not exists idx_records_group_id on public.records (group_id);
		create unique index if not exists uniq_records_group_expense_share on public.records (group_expense_share_id) where group_expense_share_id is not null and deleted_at is null;
		alter table public.records add constraint fk_records_group foreign key (group_id) references public.groups(id);
		alter table public.records add constraint fk_records_group_expense_share foreign key (group_expense_share_id) references public.group_expense_shares(id) on delete set null;
	`).Error
}

func rollbackAddRecordGroupColumns(tx *gorm.DB) error {
	if err := tx.Exec(`
		alter table public.records drop constraint if exists fk_records_group_expense_share;
		alter table public.records drop constraint if exists fk_records_group;
		drop index if exists uniq_records_group_expense_share;
		drop index if exists idx_records_group_id;
	`).Error; err != nil {
		return err
	}
	for _, field := range []string{"GroupSyncDetachedAt", "GroupExpenseShareID", "GroupID"} {
		if tx.Migrator().HasColumn(&models.Record{}, field) {
			if err := tx.Migrator().DropColumn(&models.Record{}, field); err != nil {
				return err
			}
		}
	}
	return nil
}
