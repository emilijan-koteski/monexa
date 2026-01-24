package handlers

import (
	"fmt"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
)

type authHandler struct {
	userService    *services.UserService
	tokenMaker     *token.JWTMaker
	sessionService *services.SessionService
}

func RegisterAuthHandler(
	e *echo.Echo,
	userService *services.UserService,
	tokenMaker *token.JWTMaker,
	sessionService *services.SessionService,
) {
	handler := &authHandler{
		userService:    userService,
		tokenMaker:     tokenMaker,
		sessionService: sessionService,
	}

	// Unauthenticated group
	v1 := e.Group("/api/v1/auth")

	v1.POST("/login", handler.Login)
	v1.POST("/register", handler.Register)
	v1.POST("/logout", handler.Logout)
	v1.POST("/tokens/renew", handler.RenewAccessToken)
	v1.POST("/sessions/revoke", handler.RevokeSession)

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

	user, err := h.userService.GetUserByExample(c.Request().Context(), models.User{Email: req.Email})
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "invalid credentials")
	}

	if err = utils.CheckPassword(req.Password, user.Password); err != nil {
		return responses.UnauthorizedWithMessage(c, "invalid credentials")
	}

	accessToken, accessClaims, err := h.tokenMaker.CreateAccessToken(*user)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating access token")
	}

	refreshToken, refreshClaims, err := h.tokenMaker.CreateRefreshToken(*user)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating refresh token")
	}

	session, err := h.sessionService.CreateSessionFromExample(c.Request().Context(), models.Session{
		ID:           refreshClaims.RegisteredClaims.ID,
		UserID:       user.ID,
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
	response["accessTokenExpiresAt"] = accessClaims.RegisteredClaims.ExpiresAt.Time
	response["refreshTokenExpiresAt"] = refreshClaims.RegisteredClaims.ExpiresAt.Time
	response["user"] = *user

	return responses.SuccessWithData(c, response)
}

func (h *authHandler) Register(c echo.Context) error {
	req := requests.RegisterRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	user, err := h.userService.CreateUser(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error creating user: %w", err))
	}

	return responses.SuccessWithData(c, user)
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
		return responses.FailureWithMessage(c, "error getting session")
	}

	if session.IsRevoked {
		return responses.UnauthorizedWithMessage(c, "session is revoked")
	}

	if session.UserID != refreshClaims.UserID {
		return responses.UnauthorizedWithMessage(c, "invalid session")
	}

	tmpUser := models.User{
		ID:    refreshClaims.UserID,
		Email: refreshClaims.Email,
		Name:  refreshClaims.Name,
	}
	accessToken, accessClaims, err := h.tokenMaker.CreateAccessToken(tmpUser)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating access token")
	}

	response := map[string]interface{}{}
	response["accessToken"] = accessToken
	response["accessTokenExpiresAt"] = accessClaims.RegisteredClaims.ExpiresAt.Time

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
