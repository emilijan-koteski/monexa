package requests

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" validate:"required"`
	NewPassword     string `json:"newPassword" validate:"required"`
	ConfirmPassword string `json:"confirmPassword" validate:"required"`
}
