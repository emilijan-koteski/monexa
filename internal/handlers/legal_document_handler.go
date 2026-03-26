package handlers

import (
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	dtoResponses "github.com/emilijan-koteski/monexa/internal/responses"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/labstack/echo/v4"
)

type legalDocumentHandler struct {
	legalDocumentService *services.LegalDocumentService
}

func RegisterLegalDocumentHandler(e *echo.Echo, legalDocumentService *services.LegalDocumentService) {
	handler := &legalDocumentHandler{legalDocumentService: legalDocumentService}

	// Unauthenticated group
	v1 := e.Group("/api/v1/legal-documents")

	v1.GET("", handler.GetActiveDocuments)
	v1.POST("/hash/compute", handler.ComputeHash)
	v1.POST("/hash/verify", handler.VerifyHash)

	// Restricted group
	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.GET("/pending", handler.GetPendingDocuments)
	r1.POST("/:id/accept", handler.AcceptDocument)
}

func (h *legalDocumentHandler) GetActiveDocuments(c echo.Context) error {
	docTypeStr := c.QueryParam("type")
	if docTypeStr != "" {
		docType := types.DocumentType(docTypeStr)
		if !types.IsValidDocumentType(docType) {
			return responses.BadRequestWithMessage(c, "invalid document type")
		}

		document, err := h.legalDocumentService.GetActiveDocumentByType(c.Request().Context(), docType)
		if err != nil {
			return responses.NotFoundWithMessage(c, err.Error())
		}

		return responses.SuccessWithData(c, document)
	}

	documents, err := h.legalDocumentService.GetActiveDocuments(c.Request().Context())
	if err != nil {
		return responses.FailureWithError(c, err)
	}

	return responses.SuccessWithData(c, documents)
}

func (h *legalDocumentHandler) GetPendingDocuments(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	pendingDocs, err := h.legalDocumentService.GetPendingDocuments(c.Request().Context(), claims.UserID)
	if err != nil {
		return responses.FailureWithError(c, err)
	}

	response := dtoResponses.PendingDocumentsResponse{
		HasPendingDocuments: len(pendingDocs) > 0,
		PendingDocuments:    pendingDocs,
	}

	return responses.SuccessWithData(c, response)
}

func (h *legalDocumentHandler) AcceptDocument(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	var documentID uint
	if err := echo.PathParamsBinder(c).Uint("id", &documentID).BindError(); err != nil {
		return responses.BadRequestWithMessage(c, "invalid document ID")
	}

	ipAddress := c.RealIP()
	userAgent := c.Request().UserAgent()

	err = h.legalDocumentService.AcceptDocument(c.Request().Context(), claims.UserID, documentID, ipAddress, userAgent)
	if err != nil {
		return responses.BadRequestWithMessage(c, err.Error())
	}

	return responses.Success(c)
}

func (h *legalDocumentHandler) ComputeHash(c echo.Context) error {
	req := requests.ComputeHashRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	hash := services.ComputeContentHash(req.Type, req.Version, req.Title, req.TitleMk, req.Content, req.ContentMk)

	return responses.SuccessWithData(c, map[string]string{"hash": hash})
}

func (h *legalDocumentHandler) VerifyHash(c echo.Context) error {
	req := requests.VerifyHashRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	valid := services.VerifyContentHash(req.Type, req.Version, req.Title, req.TitleMk, req.Content, req.ContentMk, req.Hash)

	return responses.SuccessWithData(c, map[string]bool{"valid": valid})
}
