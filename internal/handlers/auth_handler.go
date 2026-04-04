package handlers

import (
	"errors"
	"fmt"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type authHandler struct {
	userService          *services.UserService
	tokenMaker           *token.JWTMaker
	sessionService       *services.SessionService
	legalDocumentService *services.LegalDocumentService
}

func RegisterAuthHandler(
	e *echo.Echo,
	userService *services.UserService,
	tokenMaker *token.JWTMaker,
	sessionService *services.SessionService,
	legalDocumentService *services.LegalDocumentService,
) {
	handler := &authHandler{
		userService:          userService,
		tokenMaker:           tokenMaker,
		sessionService:       sessionService,
		legalDocumentService: legalDocumentService,
	}

	// Unauthenticated group
	v1 := e.Group("/api/v1/auth")

	v1.POST("/login", handler.Login)
	v1.POST("/register", handler.Register)
	v1.POST("/logout", handler.Logout)
	v1.POST("/tokens/renew", handler.RenewAccessToken)
	v1.POST("/sessions/revoke", handler.RevokeSession)
	v1.POST("/forgot-password", handler.ForgotPassword)
	v1.POST("/reset-password", handler.ResetPassword)

	// Restricted group
	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.DELETE("/accounts", handler.DeleteAccount)
	r1.POST("/change-password", handler.ChangePassword)
}

func (h *authHandler) Login(c echo.Context) error {
	req := requests.LoginRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	req.Email = utils.NormalizeEmail(req.Email)

	user, err := h.userService.GetUserByEmailUnscoped(c.Request().Context(), req.Email)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "invalid credentials")
	}

	if err = utils.CheckPassword(req.Password, user.Password); err != nil {
		return responses.UnauthorizedWithMessage(c, "invalid credentials")
	}

	if user.DeletedAt.Valid {
		if err = h.userService.ReactivateUser(c.Request().Context(), user.ID); err != nil {
			return responses.FailureWithMessage(c, "error reactivating account")
		}
		user.DeletedAt.Valid = false
	}

	legalAcceptedAt := h.legalDocumentService.GetLegalAcceptedAt(c.Request().Context(), user.ID)
	accessToken, _, err := h.tokenMaker.CreateAccessToken(user.ID, user.PPID, legalAcceptedAt)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating access token")
	}

	refreshToken, refreshClaims, err := h.tokenMaker.CreateRefreshToken(user.ID, user.PPID)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating refresh token")
	}

	session, err := h.sessionService.CreateSessionFromExample(c.Request().Context(), models.Session{
		ID:           refreshClaims.RegisteredClaims.ID,
		UserID:       user.ID,
		TokenFamily:  uuid.New().String(),
		RefreshToken: refreshToken,
		IsRevoked:    false,
		ExpiresAt:    refreshClaims.RegisteredClaims.ExpiresAt.Time,
		CreatedAt:    refreshClaims.RegisteredClaims.IssuedAt.Time,
		UpdatedAt:    &refreshClaims.RegisteredClaims.IssuedAt.Time,
	})
	if err != nil {
		return responses.FailureWithMessage(c, "error creating session")
	}

	response := map[string]interface{}{}
	response["sessionId"] = session.ID
	response["accessToken"] = accessToken
	response["refreshToken"] = refreshToken

	return responses.SuccessWithData(c, response)
}

func (h *authHandler) Register(c echo.Context) error {
	req := requests.RegisterRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	req.Email = utils.NormalizeEmail(req.Email)

	if h.legalDocumentService.IsEnabled() {
		if len(req.AcceptedDocumentIds) == 0 {
			return responses.BadRequestWithMessage(c, "you must accept the required legal documents")
		}

		requiredCount, err := h.legalDocumentService.GetRequiredDocumentCount(c.Request().Context())
		if err != nil {
			return responses.FailureWithMessage(c, "error checking required documents")
		}
		if len(req.AcceptedDocumentIds) < requiredCount {
			return responses.BadRequestWithMessage(c, "you must accept all required legal documents")
		}
	}

	req.IpAddress = c.RealIP()
	req.UserAgent = c.Request().UserAgent()

	user, err := h.userService.CreateUser(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error creating user: %w", err))
	}

	legalAcceptedAt := h.legalDocumentService.GetLegalAcceptedAt(c.Request().Context(), user.ID)
	accessToken, _, err := h.tokenMaker.CreateAccessToken(user.ID, user.PPID, legalAcceptedAt)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating access token")
	}

	refreshToken, refreshClaims, err := h.tokenMaker.CreateRefreshToken(user.ID, user.PPID)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating refresh token")
	}

	session, err := h.sessionService.CreateSessionFromExample(c.Request().Context(), models.Session{
		ID:           refreshClaims.RegisteredClaims.ID,
		UserID:       user.ID,
		TokenFamily:  uuid.New().String(),
		RefreshToken: refreshToken,
		IsRevoked:    false,
		ExpiresAt:    refreshClaims.RegisteredClaims.ExpiresAt.Time,
		CreatedAt:    refreshClaims.RegisteredClaims.IssuedAt.Time,
		UpdatedAt:    &refreshClaims.RegisteredClaims.IssuedAt.Time,
	})
	if err != nil {
		return responses.FailureWithMessage(c, "error creating session")
	}

	response := map[string]interface{}{}
	response["sessionId"] = session.ID
	response["accessToken"] = accessToken
	response["refreshToken"] = refreshToken

	return responses.SuccessWithData(c, response)
}

func (h *authHandler) Logout(c echo.Context) error {
	req := requests.RefreshTokenRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	err := h.sessionService.DeleteSession(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithMessage(c, "error deleting session")
	}

	return responses.Success(c)
}

func (h *authHandler) RenewAccessToken(c echo.Context) error {
	req := requests.RefreshTokenRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	refreshClaims, err := h.tokenMaker.VerifyRefreshToken(req.RefreshToken)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "invalid refresh token")
	}

	session, err := h.sessionService.GetSessionByExample(c.Request().Context(), models.Session{ID: refreshClaims.RegisteredClaims.ID})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.UnauthorizedWithMessage(c, "invalid session")
		}
		return responses.FailureWithMessage(c, "error getting session")
	}

	if session.IsRevoked {
		_ = h.sessionService.RevokeSessionFamily(c.Request().Context(), session.TokenFamily)
		return responses.UnauthorizedWithMessage(c, "session compromised")
	}

	if session.UserID != refreshClaims.UserID {
		return responses.UnauthorizedWithMessage(c, "invalid session")
	}

	user, err := h.userService.GetUserByExample(c.Request().Context(), models.User{ID: refreshClaims.UserID})
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "user not found")
	}

	newRefreshToken, newRefreshClaims, err := h.tokenMaker.CreateRefreshToken(user.ID, user.PPID)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating refresh token")
	}

	newSession, err := h.sessionService.RotateSession(c.Request().Context(), session, models.Session{
		ID:           newRefreshClaims.RegisteredClaims.ID,
		UserID:       user.ID,
		TokenFamily:  session.TokenFamily,
		RefreshToken: newRefreshToken,
		IsRevoked:    false,
		ExpiresAt:    newRefreshClaims.RegisteredClaims.ExpiresAt.Time,
		CreatedAt:    newRefreshClaims.RegisteredClaims.IssuedAt.Time,
		UpdatedAt:    &newRefreshClaims.RegisteredClaims.IssuedAt.Time,
	})
	if err != nil {
		return responses.FailureWithMessage(c, "error rotating session")
	}

	legalAcceptedAt := h.legalDocumentService.GetLegalAcceptedAt(c.Request().Context(), user.ID)
	accessToken, _, err := h.tokenMaker.CreateAccessToken(user.ID, user.PPID, legalAcceptedAt)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating access token")
	}

	response := map[string]interface{}{}
	response["sessionId"] = newSession.ID
	response["accessToken"] = accessToken
	response["refreshToken"] = newRefreshToken

	return responses.SuccessWithData(c, response)
}

func (h *authHandler) RevokeSession(c echo.Context) error {
	req := requests.RefreshTokenRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	err := h.sessionService.RevokeSession(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithMessage(c, "error revoking session")
	}

	return responses.Success(c)
}

func (h *authHandler) DeleteAccount(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	userID := claims.UserID

	if err = h.userService.DeleteUser(c.Request().Context(), userID); err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error deleting user: %w", err))
	}

	_ = h.sessionService.RevokeAllUserSessions(c.Request().Context(), userID)

	return responses.Success(c)
}

func (h *authHandler) ChangePassword(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	req := requests.ChangePasswordRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	if err := h.userService.ChangePassword(c.Request().Context(), claims.UserID, req); err != nil {
		return responses.BadRequestWithMessage(c, err.Error())
	}

	_ = h.sessionService.RevokeAllUserSessions(c.Request().Context(), claims.UserID)

	return responses.SuccessWithMessage(c, "password changed successfully")
}

func (h *authHandler) ForgotPassword(c echo.Context) error {
	req := requests.ForgotPasswordRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	req.Email = utils.NormalizeEmail(req.Email)

	_ = h.userService.RequestPasswordReset(c.Request().Context(), req.Email)

	return responses.SuccessWithMessage(c, "if that email is registered, a reset link has been sent")
}

func (h *authHandler) ResetPassword(c echo.Context) error {
	req := requests.ResetPasswordRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	if req.NewPassword != req.ConfirmPassword {
		return responses.BadRequestWithMessage(c, "passwords do not match")
	}

	user, err := h.userService.ResetPassword(c.Request().Context(), req.Token, req.NewPassword)
	if err != nil {
		return responses.BadRequestWithMessage(c, "invalid or expired reset token")
	}

	_ = h.sessionService.RevokeAllUserSessions(c.Request().Context(), user.ID)

	legalAcceptedAt := h.legalDocumentService.GetLegalAcceptedAt(c.Request().Context(), user.ID)
	accessToken, _, err := h.tokenMaker.CreateAccessToken(user.ID, user.PPID, legalAcceptedAt)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating access token")
	}

	refreshToken, refreshClaims, err := h.tokenMaker.CreateRefreshToken(user.ID, user.PPID)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating refresh token")
	}

	session, err := h.sessionService.CreateSessionFromExample(c.Request().Context(), models.Session{
		ID:           refreshClaims.RegisteredClaims.ID,
		UserID:       user.ID,
		TokenFamily:  uuid.New().String(),
		RefreshToken: refreshToken,
		IsRevoked:    false,
		ExpiresAt:    refreshClaims.RegisteredClaims.ExpiresAt.Time,
		CreatedAt:    refreshClaims.RegisteredClaims.IssuedAt.Time,
		UpdatedAt:    &refreshClaims.RegisteredClaims.IssuedAt.Time,
	})
	if err != nil {
		return responses.FailureWithMessage(c, "error creating session")
	}

	response := map[string]interface{}{}
	response["sessionId"] = session.ID
	response["accessToken"] = accessToken
	response["refreshToken"] = refreshToken

	return responses.SuccessWithData(c, response)
}
