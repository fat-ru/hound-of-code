package web

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/hound-search/hound/api"
	"github.com/hound-search/hound/auth"
	"github.com/hound-search/hound/config"
	"github.com/hound-search/hound/data"
	"github.com/hound-search/hound/searcher"
	"github.com/hound-search/hound/ui"
)

// Server is an HTTP server that handles all
// http traffic for hound. It is able to serve
// some traffic before indexes are built and
// then transition to all traffic afterwards.
type Server struct {
	cfg *config.Config
	dev bool
	ch  chan error

	mux *http.ServeMux
	lck sync.RWMutex
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == s.cfg.HealthCheckURI {
		fmt.Fprintln(w, "👍")
		return
	}

	s.lck.RLock()
	defer s.lck.RUnlock()
	if m := s.mux; m != nil {
		m.ServeHTTP(w, r)
	} else {
		http.Error(w,
			"Hound is not ready.",
			http.StatusServiceUnavailable)
	}
}

func (s *Server) serveWith(m *http.ServeMux) {
	s.lck.Lock()
	defer s.lck.Unlock()
	s.mux = m
}

// Start creates a new server that will immediately start handling HTTP traffic.
// The HTTP server will return 200 on the health check, but a 503 on every other
// request until ServeWithIndex is called to begin serving search traffic with
// the given searchers.
func Start(cfg *config.Config, addr string, dev bool) *Server {
	ch := make(chan error)

	s := &Server{
		cfg: cfg,
		dev: dev,
		ch:  ch,
	}

	go func() {
		ch <- http.ListenAndServe(addr, s)
	}()

	return s
}

// ServeWithIndex allow the server to start offering the search UI and the
// search APIs operating on the given indexes.
func (s *Server) ServeWithIndex(idx map[string]*searcher.Searcher) error {
	h, err := ui.Content(s.dev, s.cfg)
	if err != nil {
		return err
	}

	m := http.NewServeMux()

	// Auth routes (public)
	api.SetupAuth(m)

	// Protected routes with auth middleware
	protectedMux := http.NewServeMux()
	protectedMux.HandleFunc("/api/v1/users", func(w http.ResponseWriter, r *http.Request) {
		// Check if user is owner
		user := getCurrentUser(r.Context())
		if user == nil || user.Role != auth.RoleOwner {
			http.Error(w, "Owner access required", http.StatusForbidden)
			return
		}

		switch r.Method {
		case http.MethodGet:
			api.HandleGetUsers(w, r)
		case http.MethodPost:
			api.HandleCreateUser(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	protectedMux.HandleFunc("/api/v1/users/", func(w http.ResponseWriter, r *http.Request) {
		// Check if user is owner
		user := getCurrentUser(r.Context())
		if user == nil || user.Role != auth.RoleOwner {
			http.Error(w, "Owner access required", http.StatusForbidden)
			return
		}

		switch r.Method {
		case http.MethodGet:
			api.HandleGetUser(w, r)
		case http.MethodPut:
			api.HandleUpdateUser(w, r)
		case http.MethodDelete:
			api.HandleDeleteUser(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Repo config routes (authenticated - admin or user)
	protectedMux.HandleFunc("/api/v1/repos/config", func(w http.ResponseWriter, r *http.Request) {
		user := getCurrentUser(r.Context())
		if user == nil {
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		switch r.Method {
		case http.MethodGet:
			api.HandleGetRepoConfigs(w, r)
		case http.MethodPost:
			api.HandleCreateRepoConfig(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	protectedMux.HandleFunc("/api/v1/repos/config/", func(w http.ResponseWriter, r *http.Request) {
		user := getCurrentUser(r.Context())
		if user == nil {
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		switch r.Method {
		case http.MethodGet:
			api.HandleGetRepoConfigByID(w, r)
		case http.MethodPut:
			api.HandleUpdateRepoConfig(w, r)
		case http.MethodDelete:
			api.HandleDeleteRepoConfig(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Wrap protected routes with auth middleware
	authMiddleware := authMiddleware()
	m.Handle("/api/v1/users", authMiddleware(protectedMux))
	m.Handle("/api/v1/users/", authMiddleware(protectedMux))
	m.Handle("/api/v1/repos/config", authMiddleware(protectedMux))
	m.Handle("/api/v1/repos/config/", authMiddleware(protectedMux))

	// Static files and UI
	m.Handle("/", h)
	api.InitSearcherManager(idx, s.cfg.DbPath)
	api.Setup(m, s.cfg.ResultLimit)

	s.serveWith(m)

	return <-s.ch
}

// authMiddleware wraps handlers with authentication
func authMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				// No auth required for public routes, let them through
				if isPublicRoute(r.URL.Path) {
					next.ServeHTTP(w, r)
					return
				}
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
			claims, err := auth.ValidateToken(tokenString)
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
			ctx := api.SetUserInContext(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// isPublicRoute checks if a route is public
func isPublicRoute(path string) bool {
	publicRoutes := []string{
		"/api/v1/auth/login",
		"/api/v1/auth/register",
		"/api/v1/repos",
		"/api/v1/search",
		"/api/v1/excludes",
		"/api/v1/health",
	}

	for _, route := range publicRoutes {
		if path == route || strings.HasPrefix(path, route) {
			return true
		}
	}
	return false
}

// getCurrentUser gets the current user from context
func getCurrentUser(ctx context.Context) *data.User {
	if ctx == nil {
		return nil
	}
	user, ok := api.GetUserFromContext(ctx).(*data.User)
	if !ok {
		return nil
	}
	return user
}
