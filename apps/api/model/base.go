package model

// BaseModel menggabungkan primary key dan timestamp audit + soft delete,
// konsisten dengan TDD Bagian 5 (BaseModel).
type BaseModel struct {
	PrimaryKey
	BaseModelTimeAt
}
