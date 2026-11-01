package types

type GroupMemberRole string

const (
	GroupOwner  GroupMemberRole = "OWNER"
	GroupMember GroupMemberRole = "MEMBER"
)

func IsValidGroupMemberRole(role GroupMemberRole) bool {
	switch role {
	case GroupOwner, GroupMember:
		return true
	default:
		return false
	}
}
