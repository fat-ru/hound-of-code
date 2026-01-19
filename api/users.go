package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/hound-search/hound/auth"
	"github.com/hound-search/hound/data"
)

// CreateUserRequest represents a request to create a user
type CreateUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// UpdateUserRequest represents a request to update a user
type UpdateUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// UserListResponse represents a list of users
type UserListResponse struct {
	Users      []*UserResponse `json:"users"`
	TotalCount int             `json:"totalCount"`
}

// SetupUsers configures user management API routes
func SetupUsers(m *http.ServeMux) {
	m.HandleFunc("/api/v1/users", HandleGetUsers)
	m.HandleFunc("/api/v1/users/", HandleGetUser)
}

// HandleGetUsers handles GET /api/v1/users
func HandleGetUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, errors.New("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	users, err := data.GetAllUsers()
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	userResponses := make([]*UserResponse, len(users))
	for i, user := range users {
		userResponses[i] = userToResponse(user)
	}

	writeResp(w, &UserListResponse{
		Users:      userResponses,
		TotalCount: len(userResponses),
	})
}

// HandleGetUser handles user CRUD operations
func HandleGetUser(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/users/")
	if path == "" {
		writeError(w, errors.New("user ID required"), http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		HandleGetUserByID(w, r)
	case http.MethodPut:
		HandleUpdateUser(w, r)
	case http.MethodDelete:
		HandleDeleteUser(w, r)
	default:
		writeError(w, errors.New("method not allowed"), http.StatusMethodNotAllowed)
	}
}

// HandleGetUserByID handles GET /api/v1/users/:id
func HandleGetUserByID(w http.ResponseWriter, r *http.Request) {
	id, err := ParseUserID(r.URL.Path)
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	user, err := data.GetUserByID(id)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	if user == nil {
		writeError(w, errors.New("user not found"), http.StatusNotFound)
		return
	}

	writeResp(w, userToResponse(user))
}

// HandleCreateUser handles POST /api/v1/users
func HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, errors.New("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, errors.New("invalid request body"), http.StatusBadRequest)
		return
	}

	// Validate input
	if strings.TrimSpace(req.Username) == "" {
		writeError(w, errors.New("username is required"), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Password) == "" {
		writeError(w, errors.New("password is required"), http.StatusBadRequest)
		return
	}
	if len(req.Password) < 6 {
		writeError(w, errors.New("password must be at least 6 characters"), http.StatusBadRequest)
		return
	}

	// Validate role
	if req.Role != "" && req.Role != auth.RoleAdmin && req.Role != auth.RoleUser {
		writeError(w, errors.New("invalid role"), http.StatusBadRequest)
		return
	}

	// Check if user exists
	existingUser, err := data.GetUserByUsername(req.Username)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	if existingUser != nil {
		writeError(w, errors.New("username already exists"), http.StatusConflict)
		return
	}

	// Hash password
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	role := req.Role
	if role == "" {
		role = auth.RoleUser
	}

	// Create user
	user, err := data.CreateUser(req.Username, passwordHash, role)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	writeResp(w, userToResponse(user))
}

// HandleUpdateUser handles PUT /api/v1/users/:id
func HandleUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := ParseUserID(r.URL.Path)
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, errors.New("invalid request body"), http.StatusBadRequest)
		return
	}

	// Get existing user
	existingUser, err := data.GetUserByID(id)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	if existingUser == nil {
		writeError(w, errors.New("user not found"), http.StatusNotFound)
		return
	}

	// Validate input
	if strings.TrimSpace(req.Username) == "" {
		writeError(w, errors.New("username is required"), http.StatusBadRequest)
		return
	}

	// Validate role
	if req.Role != "" && req.Role != auth.RoleAdmin && req.Role != auth.RoleUser {
		writeError(w, errors.New("invalid role"), http.StatusBadRequest)
		return
	}

	// Update fields
	username := req.Username
	passwordHash := existingUser.PasswordHash
	role := req.Role

	// If password is provided, hash it
	if req.Password != "" {
		if len(req.Password) < 6 {
			writeError(w, errors.New("password must be at least 6 characters"), http.StatusBadRequest)
			return
		}
		passwordHash, err = auth.HashPassword(req.Password)
		if err != nil {
			writeError(w, err, http.StatusInternalServerError)
			return
		}
	}

	// If role is not provided, keep existing
	if role == "" {
		role = existingUser.Role
	}

	// Update user
	user, err := data.UpdateUser(id, username, passwordHash, role)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	writeResp(w, userToResponse(user))
}

// HandleDeleteUser handles DELETE /api/v1/users/:id
func HandleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := ParseUserID(r.URL.Path)
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	// Check if user exists
	existingUser, err := data.GetUserByID(id)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	if existingUser == nil {
		writeError(w, errors.New("user not found"), http.StatusNotFound)
		return
	}

	// Delete user
	if err := data.DeleteUser(id); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	writeResp(w, map[string]string{
		"message": "user deleted successfully",
	})
}

// ParseUserID extracts user ID from path
func ParseUserID(path string) (int64, error) {
	parts := strings.Split(path, "/")
	if len(parts) < 1 {
		return 0, errors.New("invalid path")
	}

	lastPart := parts[len(parts)-1]
	var id int64
	for _, c := range lastPart {
		if c < '0' || c > '9' {
			return 0, errors.New("invalid user ID")
		}
		id = id*10 + int64(c-'0')
	}
	return id, nil
}
