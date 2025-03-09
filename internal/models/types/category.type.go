package types

type CategoryType string

const (
	Income  CategoryType = "INCOME"
	Expense CategoryType = "EXPENSE"
)

func IsValidCategoryType(categoryType CategoryType) bool {
	switch categoryType {
	case Income, Expense:
		return true
	default:
		return false
	}
}
