package data

import (
	"database/sql"
	"fmt"
	"time"
)

// CreateUser creates a new user in the database
func CreateUser(username, passwordHash, role string) (*User, error) {
	result, err := db.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		username, passwordHash, role,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}

	return GetUserByID(id)
}

// GetUserByID retrieves a user by ID
func GetUserByID(id int64) (*User, error) {
	user := &User{}
	err := db.QueryRow(`
		SELECT id, username, password_hash, role, created_at, updated_at
		FROM users WHERE id = ?
	`, id).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.Role,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by id: %w", err)
	}
	return user, nil
}

// GetUserByUsername retrieves a user by username
func GetUserByUsername(username string) (*User, error) {
	user := &User{}
	err := db.QueryRow(`
		SELECT id, username, password_hash, role, created_at, updated_at
		FROM users WHERE username = ?
	`, username).Scan(
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

// GetAllUsers retrieves all users
func GetAllUsers() ([]*User, error) {
	rows, err := db.Query(`
		SELECT id, username, password_hash, role, created_at, updated_at
		FROM users ORDER BY id ASC
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
	_, err := db.Exec(`
		UPDATE users SET username = ?, password_hash = ?, role = ?, updated_at = ?
		WHERE id = ?
	`, username, passwordHash, role, now, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}
	return GetUserByID(id)
}

// UpdateUserRole updates only the user's role
func UpdateUserRole(id int64, role string) error {
	_, err := db.Exec("UPDATE users SET role = ?, updated_at = ? WHERE id = ?",
		role, time.Now(), id)
	return err
}

// DeleteUser deletes a user by ID
func DeleteUser(id int64) error {
	result, err := db.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// UserCount returns the total number of users
func UserCount() (int, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	return count, err
}
