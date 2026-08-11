package model

import (
	"time"

	"gorm.io/gorm"
)

type PrimaryKey struct {
	ID uint `json:"id" gorm:"primaryKey;autoIncrement"`
}

type BaseModelTimeAt struct {
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index" swaggerignore:"true"`
}
