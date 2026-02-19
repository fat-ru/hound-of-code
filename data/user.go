package data

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// RebuildDatabase drops and recreates all tables
func RebuildDatabase() error {
	// Drop existing tables
	if _, err := GetDB().Exec("DROP TABLE IF EXISTS users"); err != nil {
		return fmt.Errorf("failed to drop users table: %w", err)
	}
	if _, err := GetDB().Exec("DROP TABLE IF EXISTS repo_configs"); err != nil {
		return fmt.Errorf("failed to drop repo_configs table: %w", err)
	}

	// Recreate tables by re-initializing DB
	return createTables()
}

// CreateUser creates a new user in the database
func CreateUser(username, passwordHash, role string) (*User, error) {
	log.Printf("[DB] Creating user: %s with role: %s", username, role)
	previewLen := 30
	if len(passwordHash) < 30 {
		previewLen = len(passwordHash)
	}
	log.Printf("[DB] Password hash to store (len: %d): %s...", len(passwordHash), passwordHash[:previewLen]+"...")
	result, err := GetDB().Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		username, passwordHash, role)
	if err != nil {
		log.Printf("[DB] Failed to create user: %v", err)
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}

	log.Printf("[DB] User created with ID: %d", id)
	return GetUserByID(id)
}

// GetUserByID retrieves a user by ID
func GetUserByID(id int64) (*User, error) {
	user := &User{}
	err := GetDB().QueryRow(
		"SELECT id, username, password_hash, role, created_at, updated_at FROM users WHERE id = ?",
		id).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.Role,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}
	return user, nil
}

// GetUserByUsername retrieves a user by username
func GetUserByUsername(username string) (*User, error) {
	user := &User{}
	err := GetDB().QueryRow(
		"SELECT id, username, password_hash, role, created_at, updated_at FROM users WHERE username = ?",
		username).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.Role,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}
	// Debug: log the password_hash length
	previewLen := 30
	if len(user.PasswordHash) < 30 {
		previewLen = len(user.PasswordHash)
	}
	log.Printf("[DB] Retrieved user %s, password_hash length: %d, password_hash: %s...",
		username, len(user.PasswordHash), user.PasswordHash[:previewLen]+"...")
	return user, nil
}

// GetAllUsers retrieves all users
func GetAllUsers() ([]*User, error) {
	rows, err := GetDB().Query(`
		SELECT id, username, password_hash, role, created_at, updated_at FROM users ORDER BY id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get all users: %w", err)
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		user := &User{}
		if err := rows.Scan(
			&user.ID, &user.Username, &user.PasswordHash, &user.Role,
			&user.CreatedAt, &user.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}
	return users, nil
}

// UpdateUser updates a user's information
func UpdateUser(id int64, username, passwordHash, role string) (*User, error) {
	now := time.Now()
	_, err := GetDB().Exec(
		"UPDATE users SET username = ?, password_hash = ?, role = ?, updated_at = ? WHERE id = ?",
		username, passwordHash, role, now, id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}
	return GetUserByID(id)
}

// UpdateUserRole updates only a user's role
func UpdateUserRole(id int64, role string) error {
	_, err := GetDB().Exec("UPDATE users SET role = ?, updated_at = ? WHERE id = ?",
		role, time.Now(), id)
	return err
}

// DeleteUser deletes a user by ID
func DeleteUser(id int64) error {
	result, err := GetDB().Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// UserCount returns total number of users
func UserCount() (int, error) {
	var count int
	err := GetDB().QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	return count, err
}
