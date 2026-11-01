package handlers

import (
	"strconv"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
)

type groupExpenseHandler struct {
	groupService   *services.GroupService
	expenseService *services.GroupExpenseService
}

func RegisterGroupExpenseHandler(e *echo.Echo, groupService *services.GroupService, expenseService *services.GroupExpenseService, restrictedMiddlewares ...echo.MiddlewareFunc) {
	handler := &groupExpenseHandler{groupService: groupService, expenseService: expenseService}

	r1 := e.Group("/api/v1/groups/:id")
	r1.Use(middlewares.AuthMiddleware())
	for _, m := range restrictedMiddlewares {
		r1.Use(m)
	}

	r1.PATCH("/me", handler.UpdateMe)
	r1.GET("/expenses", handler.ListExpenses)
	r1.POST("/expenses", handler.CreateExpense)
	r1.PATCH("/expenses/:expenseId", handler.UpdateExpense)
	r1.DELETE("/expenses/:expenseId", handler.DeleteExpense)
	r1.GET("/settlements", handler.ListSettlements)
	r1.POST("/settlements", handler.CreateSettlement)
	r1.DELETE("/settlements/:settlementId", handler.DeleteSettlement)
	r1.GET("/balances", handler.Balances)
	r1.GET("/stats", handler.Stats)
}

func groupAndUser(c echo.Context) (uint, uint, error) {
	groupID, err := utils.ParseIDParam(c)
	if err != nil {
		return 0, 0, err
	}
	userID, err := currentUserID(c)
	if err != nil {
		return 0, 0, err
	}
	return groupID, userID, nil
}

func (h *groupExpenseHandler) UpdateMe(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	var req requests.GroupMeRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}
	if err := h.expenseService.UpdateMe(c.Request().Context(), groupID, userID, req); err != nil {
		return groupFailure(c, "updating your group settings", err)
	}
	group, err := h.groupService.Get(c.Request().Context(), groupID, userID)
	if err != nil {
		return groupFailure(c, "reading group", err)
	}
	return responses.SuccessWithData(c, group)
}

func (h *groupExpenseHandler) ListExpenses(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	expenses, err := h.expenseService.List(c.Request().Context(), groupID, userID)
	if err != nil {
		return groupFailure(c, "listing expenses", err)
	}
	return responses.SuccessWithData(c, expenses)
}

func (h *groupExpenseHandler) CreateExpense(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	var req requests.GroupExpenseRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}
	expense, err := h.expenseService.Create(c.Request().Context(), groupID, userID, req)
	if err != nil {
		return groupFailure(c, "adding expense", err)
	}
	return responses.CreatedWithData(c, expense)
}

func (h *groupExpenseHandler) UpdateExpense(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	expenseID, err := utils.ParseUintParam(c, "expenseId")
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	var req requests.GroupExpenseRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}
	expense, err := h.expenseService.Update(c.Request().Context(), groupID, expenseID, userID, req)
	if err != nil {
		return groupFailure(c, "updating expense", err)
	}
	return responses.SuccessWithData(c, expense)
}

func (h *groupExpenseHandler) DeleteExpense(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	expenseID, err := utils.ParseUintParam(c, "expenseId")
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	var version *int
	if raw := c.QueryParam("version"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			return responses.BadRequestWithMessage(c, "invalid version")
		}
		version = &parsed
	}
	removeSettlements := c.QueryParam("removeSettlements") != "false"
	if err := h.expenseService.Delete(c.Request().Context(), groupID, expenseID, userID, version, removeSettlements); err != nil {
		return groupFailure(c, "deleting expense", err)
	}
	return responses.Success(c)
}

func (h *groupExpenseHandler) ListSettlements(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	settlements, err := h.expenseService.ListSettlements(c.Request().Context(), groupID, userID)
	if err != nil {
		return groupFailure(c, "listing payments", err)
	}
	return responses.SuccessWithData(c, settlements)
}

func (h *groupExpenseHandler) CreateSettlement(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	var req requests.GroupSettlementRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}
	settlement, err := h.expenseService.CreateSettlement(c.Request().Context(), groupID, userID, req)
	if err != nil {
		return groupFailure(c, "recording payment", err)
	}
	return responses.CreatedWithData(c, settlement)
}

func (h *groupExpenseHandler) DeleteSettlement(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	settlementID, err := utils.ParseUintParam(c, "settlementId")
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	if err := h.expenseService.DeleteSettlement(c.Request().Context(), groupID, settlementID, userID); err != nil {
		return groupFailure(c, "deleting payment", err)
	}
	return responses.Success(c)
}

func (h *groupExpenseHandler) Balances(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	balances, err := h.expenseService.Balances(c.Request().Context(), groupID, userID)
	if err != nil {
		return groupFailure(c, "reading balances", err)
	}
	return responses.SuccessWithData(c, balances)
}

func (h *groupExpenseHandler) Stats(c echo.Context) error {
	groupID, userID, err := groupAndUser(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	stats, err := h.expenseService.Stats(c.Request().Context(), groupID, userID)
	if err != nil {
		return groupFailure(c, "reading stats", err)
	}
	return responses.SuccessWithData(c, stats)
}
