package models

type PaymentMethod struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	UserID uint   `gorm:"not null;index" json:"userId"`
	Name   string `gorm:"not null" json:"name"`
}
