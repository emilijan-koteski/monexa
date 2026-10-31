package handlers

import (
	"errors"
	"log"
	"strconv"
	"time"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
)

var groupJoinRateLimit = rateLimit{requests: 10, window: time.Minute, burst: 10}

type groupHandler struct {
	groupService *services.GroupService
}

func RegisterGroupHandler(e *echo.Echo, groupService *services.GroupService, restrictedMiddlewares ...echo.MiddlewareFunc) {
	handler := &groupHandler{groupService: groupService}

	r1 := e.Group("/api/v1/groups")
	r1.Use(middlewares.AuthMiddleware())
	for _, m := range restrictedMiddlewares {
		r1.Use(m)
	}

	joinLimit := limitPerUser(newRateLimiter(groupJoinRateLimit), denyGroupRateLimited)

	r1.GET("", handler.List)
	r1.POST("", handler.Create)
	r1.GET("/join/:code", handler.JoinPreview, joinLimit)
	r1.POST("/join/:code", handler.Join, joinLimit)
	r1.GET("/:id", handler.Read)
	r1.PATCH("/:id", handler.Update)
	r1.DELETE("/:id", handler.Delete)
	r1.POST("/:id/invite-code", handler.RegenerateInvite)
	r1.DELETE("/:id/invite-code", handler.DisableInvite)
	r1.POST("/:id/members", handler.AddMember)
	r1.PATCH("/:id/members/:memberId", handler.UpdateMember)
	r1.DELETE("/:id/members/:memberId", handler.RemoveMember)
	r1.DELETE("/:id/members/:memberId/link", handler.UnlinkMember)
	r1.DELETE("/:id/me", handler.Leave)
}

// limitPerUser rate-limits by the signed-in user, falling back to the client IP.
func limitPerUser(limiter *rateLimiter, deny func(echo.Context, time.Duration) error) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			key := "ip:" + c.RealIP()
			if claims, err := middlewares.GetUserClaims(c); err == nil {
				key = "user:" + strconv.FormatUint(uint64(claims.UserID), 10)
			}
			if retryAfter, exceeded := limiter.take(key); exceeded {
				return deny(c, retryAfter)
			}
			return next(c)
		}
	}
}

func denyGroupRateLimited(c echo.Context, retryAfter time.Duration) error {
	setRetryAfter(c, retryAfter)
	return responses.TooManyRequestsWithMessage(c, "too many attempts, try again in a minute")
}

func currentUserID(c echo.Context) (uint, error) {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return 0, err
	}
	return claims.UserID, nil
}

// groupFailure maps shared-group service errors to the API envelope, hiding unexpected errors behind a generic message.
func groupFailure(c echo.Context, operation string, err error) error {
	switch {
	case errors.Is(err, services.ErrGroupValidation),
		errors.Is(err, services.ErrReferenceNotFound),
		errors.Is(err, services.ErrRateUnavailable):
		return responses.BadRequestWithMessage(c, err.Error())
	case errors.Is(err, services.ErrGroupNotFound),
		errors.Is(err, services.ErrMemberNotFound),
		errors.Is(err, services.ErrExpenseNotFound),
		errors.Is(err, services.ErrSettlementNotFound),
		errors.Is(err, services.ErrInviteInvalid):
		return responses.NotFoundWithMessage(c, err.Error())
	case errors.Is(err, services.ErrGroupForbidden):
		return responses.ForbiddenWithMessage(c, err.Error())
	case errors.Is(err, services.ErrGroupArchived),
		errors.Is(err, services.ErrAlreadyMember),
		errors.Is(err, services.ErrGuestAlreadyClaimed),
		errors.Is(err, services.ErrMemberHasActivity),
		errors.Is(err, services.ErrBaseCurrencyLocked),
		errors.Is(err, services.ErrDisplayNameTaken),
		errors.Is(err, services.ErrOwnerMustTransfer),
		errors.Is(err, services.ErrGroupMemberLimit),
		errors.Is(err, services.ErrVersionConflict),
		errors.Is(err, services.ErrShareNotTickable),
		errors.Is(err, services.ErrShareAlreadyTicked):
		return responses.ConflictWithMessage(c, err.Error())
	}
	log.Printf("groups: %s failed: %v", operation, err)
	return responses.FailureWithMessage(c, "error "+operation)
}

func (h *groupHandler) List(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	groups, err := h.groupService.List(c.Request().Context(), userID)
	if err != nil {
		return groupFailure(c, "listing groups", err)
	}
	return responses.SuccessWithData(c, groups)
}

func (h *groupHandler) Create(c echo.Context) error {
	var req requests.GroupRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	group, err := h.groupService.Create(c.Request().Context(), userID, req)
	if err != nil {
		return groupFailure(c, "creating group", err)
	}
	return responses.CreatedWithData(c, group)
}

func (h *groupHandler) Read(c echo.Context) error {
	groupID, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	group, err := h.groupService.Get(c.Request().Context(), groupID, userID)
	if err != nil {
		return groupFailure(c, "reading group", err)
	}
	return responses.SuccessWithData(c, group)
}

func (h *groupHandler) Update(c echo.Context) error {
	groupID, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	var req requests.GroupRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	group, err := h.groupService.Update(c.Request().Context(), groupID, userID, req)
	if err != nil {
		return groupFailure(c, "updating group", err)
	}
	return responses.SuccessWithData(c, group)
}

func (h *groupHandler) Delete(c echo.Context) error {
	groupID, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	if err := h.groupService.Delete(c.Request().Context(), groupID, userID); err != nil {
		return groupFailure(c, "deleting group", err)
	}
	return responses.Success(c)
}

func (h *groupHandler) RegenerateInvite(c echo.Context) error {
	groupID, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	group, err := h.groupService.RegenerateInvite(c.Request().Context(), groupID, userID)
	if err != nil {
		return groupFailure(c, "creating invite code", err)
	}
	return responses.SuccessWithData(c, group)
}

func (h *groupHandler) DisableInvite(c echo.Context) error {
	groupID, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	group, err := h.groupService.DisableInvite(c.Request().Context(), groupID, userID)
	if err != nil {
		return groupFailure(c, "turning off invites", err)
	}
	return responses.SuccessWithData(c, group)
}

func (h *groupHandler) JoinPreview(c echo.Context) error {
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	preview, err := h.groupService.JoinPreview(c.Request().Context(), c.Param("code"), userID)
	if err != nil {
		return groupFailure(c, "reading invite", err)
	}
	return responses.SuccessWithData(c, preview)
}

func (h *groupHandler) Join(c echo.Context) error {
	var req requests.GroupJoinRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	joined, err := h.groupService.Join(c.Request().Context(), c.Param("code"), userID, req)
	if err != nil {
		return groupFailure(c, "joining group", err)
	}
	return responses.SuccessWithData(c, joined)
}

func (h *groupHandler) AddMember(c echo.Context) error {
	groupID, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	var req requests.GroupMemberRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	group, err := h.groupService.AddMember(c.Request().Context(), groupID, userID, req)
	if err != nil {
		return groupFailure(c, "adding person", err)
	}
	return responses.SuccessWithData(c, group)
}

func (h *groupHandler) UpdateMember(c echo.Context) error {
	groupID, memberID, userID, err := groupMemberParams(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	var req requests.GroupMemberRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}
	group, err := h.groupService.UpdateMember(c.Request().Context(), groupID, memberID, userID, req)
	if err != nil {
		return groupFailure(c, "updating person", err)
	}
	return responses.SuccessWithData(c, group)
}

func (h *groupHandler) RemoveMember(c echo.Context) error {
	groupID, memberID, userID, err := groupMemberParams(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	group, err := h.groupService.RemoveMember(c.Request().Context(), groupID, memberID, userID)
	if err != nil {
		return groupFailure(c, "removing person", err)
	}
	return responses.SuccessWithData(c, group)
}

func (h *groupHandler) UnlinkMember(c echo.Context) error {
	groupID, memberID, userID, err := groupMemberParams(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	group, err := h.groupService.UnlinkMember(c.Request().Context(), groupID, memberID, userID)
	if err != nil {
		return groupFailure(c, "unlinking account", err)
	}
	return responses.SuccessWithData(c, group)
}

func (h *groupHandler) Leave(c echo.Context) error {
	groupID, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	userID, err := currentUserID(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	keepRecords := c.QueryParam("keepRecords") != "false"
	if err := h.groupService.Leave(c.Request().Context(), groupID, userID, keepRecords); err != nil {
		return groupFailure(c, "leaving group", err)
	}
	return responses.Success(c)
}

func groupMemberParams(c echo.Context) (uint, uint, uint, error) {
	groupID, err := utils.ParseIDParam(c)
	if err != nil {
		return 0, 0, 0, err
	}
	memberID, err := utils.ParseUintParam(c, "memberId")
	if err != nil {
		return 0, 0, 0, err
	}
	userID, err := currentUserID(c)
	if err != nil {
		return 0, 0, 0, err
	}
	return groupID, memberID, userID, nil
}
