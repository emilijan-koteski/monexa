package requests

type AccessTokenRequest struct {
	Name          string `json:"name"`
	Permission    string `json:"permission"`
	ExpiresInDays int    `json:"expiresInDays"`
}
