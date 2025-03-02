package requests

type RenewAccessTokenRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}
