package handlers

import (
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/labstack/echo/v4"
)

type userHandler struct {
	userService *services.UserService
}

func RegisterUserHandler(e *echo.Echo, userService *services.UserService) {
	handler := &userHandler{userService: userService}

	v1 := e.Group("/api/v1/users")

	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.PATCH("", handler.Update)
}

func (h *userHandler) Update(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	req := requests.UpdateUserRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	user, err := h.userService.UpdateUser(c.Request().Context(), claims.UserID, req)
	if err != nil {
		return responses.BadRequestWithMessage(c, err.Error())
	}

	return responses.SuccessWithData(c, user)
}
