package utils

import (
	"errors"
	"github.com/labstack/echo/v4"
	"strconv"
)

func ParseIDParam(c echo.Context) (uint, error) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		return 0, errors.New("invalid ID parameter")
	}
	return uint(id), nil
}
