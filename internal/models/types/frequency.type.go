package types

type FrequencyType string

const (
	Daily   FrequencyType = "DAILY"
	Weekly  FrequencyType = "WEEKLY"
	Monthly FrequencyType = "MONTHLY"
	Yearly  FrequencyType = "YEARLY"
)

func IsValidFrequencyType(frequencyType FrequencyType) bool {
	switch frequencyType {
	case Daily, Weekly, Monthly, Yearly:
		return true
	default:
		return false
	}
}
