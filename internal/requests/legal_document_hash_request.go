package requests

type ComputeHashRequest struct {
	Type      string `json:"type" validate:"required"`
	Version   int    `json:"version" validate:"required"`
	Title     string `json:"title" validate:"required"`
	TitleMk   string `json:"titleMk" validate:"required"`
	Content   string `json:"content" validate:"required"`
	ContentMk string `json:"contentMk" validate:"required"`
}

type VerifyHashRequest struct {
	ComputeHashRequest
	Hash string `json:"hash" validate:"required"`
}
