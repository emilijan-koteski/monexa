package responses

import (
	"github.com/labstack/echo/v4"
	"net/http"
)

func createMessageBody(status int, message string) map[string]interface{} {
	body := map[string]interface{}{}
	body["status"] = status
	body["message"] = message

	return body
}

func createDataBody(status int, data interface{}) map[string]interface{} {
	body := map[string]interface{}{}
	body["status"] = status
	body["data"] = data

	return body
}

func createErrorBody(status int, error string) map[string]interface{} {
	body := map[string]interface{}{}
	body["status"] = status
	body["error"] = error

	return body
}

// StatusOK: 200

func Success(c echo.Context) error {
	return SuccessWithMessage(c, "success")
}

func SuccessWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusOK, createMessageBody(http.StatusOK, message))
}

func SuccessWithData(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, createDataBody(http.StatusOK, data))
}

// StatusCreated: 201

func Created(c echo.Context) error {
	return CreatedWithMessage(c, "success")
}

func CreatedWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusCreated, createMessageBody(http.StatusCreated, message))
}

func CreatedWithData(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusCreated, createDataBody(http.StatusCreated, data))
}

// StatusBadRequest: 400

func BadRequest(c echo.Context) error {
	return BadRequestWithMessage(c, "bad request")
}

func BadRequestWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusBadRequest, createMessageBody(http.StatusBadRequest, message))
}

func BadRequestWithError(c echo.Context, error error) error {
	return c.JSON(http.StatusBadRequest, createErrorBody(http.StatusBadRequest, error.Error()))
}

// StatusUnauthorized: 401

func Unauthorized(c echo.Context) error {
	return UnauthorizedWithMessage(c, "unauthorized")
}

func UnauthorizedWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusUnauthorized, createMessageBody(http.StatusUnauthorized, message))
}

// StatusForbidden: 403

func Forbidden(c echo.Context) error {
	return ForbiddenWithMessage(c, "forbidden")
}

func ForbiddenWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusForbidden, createMessageBody(http.StatusForbidden, message))
}

// StatusNotFound: 404

func NotFound(c echo.Context) error {
	return NotFoundWithMessage(c, "not found")
}

func NotFoundWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusNotFound, createMessageBody(http.StatusNotFound, message))
}

func NotFoundWithError(c echo.Context, error error) error {
	return c.JSON(http.StatusNotFound, createErrorBody(http.StatusNotFound, error.Error()))
}

// StatusConflict: 409

func Conflict(c echo.Context) error {
	return ConflictWithMessage(c, "conflict")
}

func ConflictWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusConflict, createMessageBody(http.StatusConflict, message))
}

// StatusUnavailableForLegalReasons: 451

func LegalAcceptanceRequired(c echo.Context) error {
	return LegalAcceptanceRequiredWithMessage(c, "legal acceptance required")
}

func LegalAcceptanceRequiredWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusUnavailableForLegalReasons, createMessageBody(http.StatusUnavailableForLegalReasons, message))
}

// StatusInternalServerError: 500

func Failure(c echo.Context) error {
	return FailureWithMessage(c, "failure")
}

func FailureWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusInternalServerError, createMessageBody(http.StatusInternalServerError, message))
}

func FailureWithError(c echo.Context, error error) error {
	return c.JSON(http.StatusInternalServerError, createErrorBody(http.StatusInternalServerError, error.Error()))
}

// StatusNotImplemented: 501

func NotImplemented(c echo.Context) error {
	return NotImplementedWithMessage(c, "not implemented")
}

func NotImplementedWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusNotImplemented, createMessageBody(http.StatusNotImplemented, message))
}

// StatusServiceUnavailable: 503

func ServiceUnavailable(c echo.Context) error {
	return ServiceUnavailableWithMessage(c, "service unavailable")
}

func ServiceUnavailableWithMessage(c echo.Context, message string) error {
	return c.JSON(http.StatusServiceUnavailable, createMessageBody(http.StatusServiceUnavailable, message))
}
