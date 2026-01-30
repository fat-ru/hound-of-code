package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/hound-search/hound/data"
)

// ContextKey is the key type for context values
type ContextKey string

const (
	// UserContextKey is the key for storing user in context
	UserContextKey ContextKey = "user"
)

// AuthMiddleware creates an authentication middleware
func AuthMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip auth for public routes
			if isPublicRoute(r.URL.Path, r.Method) {
				next.ServeHTTP(w, r)
				return
			}

			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Authorization header required", http.StatusUnauthorized)
				return
			}

			// Check Bearer token format
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]
			claims, err := ValidateToken(tokenString)
			if err != nil {
				http.Error(w, "Invalid token: "+err.Error(), http.StatusUnauthorized)
				return
			}

			// Get user from database
			user, err := data.GetUserByID(claims.UserID)
			if err != nil || user == nil {
				http.Error(w, "User not found", http.StatusUnauthorized)
				return
			}

			// Store user in request context
			ctx := r.Context()
			ctx = setUserInContext(ctx, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// AdminMiddleware creates an admin-only middleware
func AdminMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := getUserFromContext(r.Context())
			if user == nil {
				http.Error(w, "Authentication required", http.StatusUnauthorized)
				return
			}

			if user.Role != RoleAdmin {
				http.Error(w, "Admin access required", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// isPublicRoute checks if a route is public (doesn't require authentication)
func isPublicRoute(path, method string) bool {
	// Public API routes
	publicRoutes := []string{
		"/api/v1/auth/login",
		"/api/v1/auth/register",
		"/api/v1/repos",
		"/api/v1/repos/config",
		"/api/v1/search",
		"/api/v1/excludes",
		"/api/v1/health",
	}

	for _, route := range publicRoutes {
		if strings.HasPrefix(path, route) {
			return true
		}
	}

	// Static assets
	if strings.HasPrefix(path, "/css/") ||
		strings.HasPrefix(path, "/js/") ||
		strings.HasPrefix(path, "/images/") ||
		strings.HasPrefix(path, "/fonts/") {
		return true
	}

	// HTML pages (login, register)
	if method == "GET" && (path == "/" || path == "/login" || path == "/register" ||
		path == "/settings" || strings.HasPrefix(path, "/excluded_files")) {
		return true
	}

	return false
}

// requireRole creates a middleware that requires a specific role
func requireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := getUserFromContext(r.Context())
			if user == nil {
				http.Error(w, "Authentication required", http.StatusUnauthorized)
				return
			}

			hasRole := false
			for _, role := range roles {
				if user.Role == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				http.Error(w, "Insufficient permissions", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// setUserInContext sets the user in the context
func setUserInContext(ctx context.Context, user *data.User) context.Context {
	return context.WithValue(ctx, UserContextKey, user)
}

// getUserFromContext gets the user from the context
func getUserFromContext(ctx context.Context) *data.User {
	if ctx == nil {
		return nil
	}
	user, ok := ctx.Value(UserContextKey).(*data.User)
	if !ok {
		return nil
	}
	return user
}

// WriteJSON writes a JSON response
func WriteJSON(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
	}
}

// WriteError writes an error response
func WriteError(w http.ResponseWriter, err error, status int) {
	WriteJSON(w, map[string]string{
		"error": err.Error(),
	}, status)
}

// RequireAuth is a helper function to require authentication
func RequireAuth(w http.ResponseWriter, r *http.Request) (*data.User, error) {
	// This is now handled by the middleware
	// Keep for backwards compatibility
	return nil, errors.New("auth middleware not applied")
}
