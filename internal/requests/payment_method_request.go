package requests

type PaymentMethodRequest struct {
	ID     *uint
	UserID *uint
	Name   *string `json:"name"`
}
