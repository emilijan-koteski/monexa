package types

type GroupExpenseCategory string

const (
	GroupFood          GroupExpenseCategory = "FOOD"
	GroupGroceries     GroupExpenseCategory = "GROCERIES"
	GroupDrinks        GroupExpenseCategory = "DRINKS"
	GroupTransport     GroupExpenseCategory = "TRANSPORT"
	GroupAccommodation GroupExpenseCategory = "ACCOMMODATION"
	GroupActivities    GroupExpenseCategory = "ACTIVITIES"
	GroupShopping      GroupExpenseCategory = "SHOPPING"
	GroupOther         GroupExpenseCategory = "OTHER"
)

func IsValidGroupExpenseCategory(category GroupExpenseCategory) bool {
	switch category {
	case GroupFood, GroupGroceries, GroupDrinks, GroupTransport, GroupAccommodation, GroupActivities, GroupShopping, GroupOther:
		return true
	default:
		return false
	}
}
