package handlers

import (
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
	"time"
)

type authHandler struct {
	userService *services.UserService
	tokenMaker  *token.JWTMaker
}

func RegisterAuthHandler(
	e *echo.Echo,
	userService *services.UserService,
	tokenMaker *token.JWTMaker,
) {
	handler := &authHandler{
		userService: userService,
		tokenMaker:  tokenMaker,
	}

	v1 := e.Group("/api/v1/auth")

	v1.POST("/login", handler.Login)
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

	accessToken, _, err := h.tokenMaker.CreateToken(user, 15*time.Minute)
	if err != nil {
		return responses.FailureWithMessage(c, "error creating token")
	}

	response := map[string]interface{}{}
	response["accessToken"] = accessToken
	response["user"] = user

	return responses.SuccessWithData(c, response)
}
