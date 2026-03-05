package requests

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ResetPasswordRequest struct {
	Token           string `json:"token" validate:"required"`
	NewPassword     string `json:"newPassword" validate:"required"`
	ConfirmPassword string `json:"confirmPassword" validate:"required"`
}
