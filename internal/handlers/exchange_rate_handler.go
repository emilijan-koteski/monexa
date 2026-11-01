package handlers

import (
	"errors"
	"fmt"
	"time"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	dtoResponses "github.com/emilijan-koteski/monexa/internal/responses"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
)

type exchangeRateHandler struct {
	currencyService *services.CurrencyService
}

func RegisterExchangeRateHandler(e *echo.Echo, currencyService *services.CurrencyService, restrictedMiddlewares ...echo.MiddlewareFunc) {
	handler := &exchangeRateHandler{currencyService: currencyService}

	r1 := e.Group("/api/v1/exchange-rates")
	r1.Use(middlewares.AuthMiddleware())
	for _, m := range restrictedMiddlewares {
		r1.Use(m)
	}

	r1.GET("/rate", handler.GetRate)
}

func (h *exchangeRateHandler) GetRate(c echo.Context) error {
	var req requests.ExchangeRateQuoteRequest
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid query parameters")
	}
	if !types.IsValidCurrencyType(req.From) || !types.IsValidCurrencyType(req.To) {
		return responses.BadRequestWithMessage(c, "invalid currency")
	}

	date := utils.NoonUTC(time.Now())
	if req.Date != "" {
		parsed, err := utils.ParseDay(req.Date)
		if err != nil {
			return responses.BadRequestWithError(c, err)
		}
		date = parsed
	}

	quote, err := h.currencyService.GetRate(c.Request().Context(), date, req.From, req.To)
	if err != nil {
		if errors.Is(err, services.ErrRateUnavailable) {
			return responses.NotFoundWithMessage(c, "no exchange rate available for this pair")
		}
		return responses.FailureWithError(c, fmt.Errorf("error reading exchange rate: %w", err))
	}

	return responses.SuccessWithData(c, dtoResponses.ExchangeRateQuoteResponse{
		From:      req.From,
		To:        req.To,
		Date:      date.Format("2006-01-02"),
		Rate:      quote.Rate,
		Source:    quote.Source,
		FetchedAt: quote.FetchedAt,
	})
}
