package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/hound-search/hound/auth"
	"github.com/hound-search/hound/data"
)

// LoginRequest represents a login request
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// AuthResponse represents an authentication response
type AuthResponse struct {
	Token    string       `json:"token"`
	User     *UserResponse `json:"user"`
}

// UserResponse represents a user in API responses
type UserResponse struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt"`
}

func userToResponse(user *data.User) *UserResponse {
	return &UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Role:      user.Role,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// SetupAuth configures authentication API routes
func SetupAuth(m *http.ServeMux) {
	// Public routes
	m.HandleFunc("/api/v1/auth/register", handleRegister)
	m.HandleFunc("/api/v1/auth/login", handleLogin)

	// Protected routes
	// Note: These are protected by the auth middleware in Setup()
	m.HandleFunc("/api/v1/auth/me", handleMe)
	m.HandleFunc("/api/v1/auth/logout", handleLogout)
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, errors.New("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
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

	// Check if this is the first user (becomes admin)
	role := auth.RoleUser
	userCount, err := data.UserCount()
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	if userCount == 0 {
		role = auth.RoleAdmin
	}

	// Create user
	user, err := data.CreateUser(req.Username, passwordHash, role)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	// Generate token
	token, err := auth.GenerateToken(user)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	writeResp(w, &AuthResponse{
		Token: token,
		User:  userToResponse(user),
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, errors.New("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
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

	// Get user
	user, err := data.GetUserByUsername(req.Username)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	if user == nil {
		writeError(w, errors.New("invalid username or password"), http.StatusUnauthorized)
		return
	}

	// Check password
	if !auth.CheckPassword(req.Password, user.PasswordHash) {
		writeError(w, errors.New("invalid username or password"), http.StatusUnauthorized)
		return
	}

	// Generate token
	token, err := auth.GenerateToken(user)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	writeResp(w, &AuthResponse{
		Token: token,
		User:  userToResponse(user),
	})
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, errors.New("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	// Get user from context (set by middleware)
	user := getUserFromContext(r.Context())
	if user == nil {
		writeError(w, errors.New("not authenticated"), http.StatusUnauthorized)
		return
	}

	writeResp(w, userToResponse(user))
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, errors.New("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	// In a stateless JWT setup, logout is handled client-side by removing the token
	// For a more robust solution, you could implement token blacklisting
	writeResp(w, map[string]string{
		"message": "logged out successfully",
	})
}

// getUserFromContext gets the user from the request context
func getUserFromContext(ctx context.Context) *data.User {
	if ctx == nil {
		return nil
	}
	user, ok := GetUserFromContext(ctx).(*data.User)
	if !ok {
		return nil
	}
	return user
}
