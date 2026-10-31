package utils

import (
	"errors"
	"strconv"

	"github.com/labstack/echo/v4"
)

func ParseIDParam(c echo.Context) (uint, error) {
	return ParseUintParam(c, "id")
}

// ParseUintParam reads a positive integer path parameter by name.
func ParseUintParam(c echo.Context, name string) (uint, error) {
	id, err := strconv.Atoi(c.Param(name))
	if err != nil || id <= 0 {
		return 0, errors.New("invalid " + name + " parameter")
	}
	return uint(id), nil
}
