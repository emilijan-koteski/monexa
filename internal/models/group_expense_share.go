package models

type GroupExpenseShare struct {
	ID         uint     `gorm:"primaryKey" json:"id"`
	ExpenseID  uint     `gorm:"not null;uniqueIndex:idx_group_expense_shares_expense_member" json:"expenseId"`
	MemberID   uint     `gorm:"not null;uniqueIndex:idx_group_expense_shares_expense_member;index" json:"memberId"`
	Amount     *float64 `gorm:"type:numeric(14,2)" json:"amount"`
	BaseAmount *float64 `gorm:"type:numeric(14,2)" json:"baseAmount"`
}
