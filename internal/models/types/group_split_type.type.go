package types

type GroupSplitType string

const (
	SplitEqual GroupSplitType = "EQUAL"
	SplitExact GroupSplitType = "EXACT"
)

func IsValidGroupSplitType(splitType GroupSplitType) bool {
	switch splitType {
	case SplitEqual, SplitExact:
		return true
	default:
		return false
	}
}
