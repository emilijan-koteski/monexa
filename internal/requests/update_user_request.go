package requests

type UpdateUserRequest struct {
	Name string `json:"name" validate:"required"`
}
