package services

import (
	"gorm.io/gorm"
)

type HealthService struct {
	db *gorm.DB
}

func NewHealthService(db *gorm.DB) *HealthService {
	return &HealthService{db: db}
}

func (s *HealthService) CheckHealth() bool {
	sqlDB, err := s.db.DB()
	if err != nil {
		return false
	}

	err = sqlDB.Ping()
	return err == nil
}
