package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hound-search/hound/data"
)

const (
	RoleAdmin = "admin"
	RoleUser  = "user"
)

var jwtSecret []byte

// Claims represents the JWT claims
type Claims struct {
	UserID   int64  `json:"userId"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// InitAuth initializes the auth module
// If secret is empty, generates a random secret and logs a warning
// SetJwtSecret can be called later to set a fixed secret from config
func InitAuth(secret string) error {
	if secret == "" || secret == "[]" {
		// Generate a random secret if not provided
		secretBytes := make([]byte, 32)
		if _, err := rand.Read(secretBytes); err != nil {
			return fmt.Errorf("failed to generate JWT secret: %w", err)
		}
		jwtSecret = secretBytes
	} else {
		jwtSecret = []byte(secret)
	}
	return nil
}

// SetJwtSecret sets the JWT secret from config file
// This allows the secret to persist across restarts
func SetJwtSecret(secret string) {
	if secret != "" && secret != "[]" {
		jwtSecret = []byte(secret)
	}
}

// SetJWTSecret sets the JWT secret directly
func SetJWTSecret(secret string) {
	jwtSecret = []byte(secret)
}

// HashPassword hashes a password using bcrypt-like method
func HashPassword(password string) (string, error) {
	// Generate a random salt
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("failed to generate salt: %w", err)
	}

	// Simple hash for demonstration
	// In production, use bcrypt like golang.org/x/crypto/bcrypt
	hash := base64.StdEncoding.EncodeToString([]byte(password + string(salt)))
	return fmt.Sprintf("%s:%s", base64.StdEncoding.EncodeToString(salt), hash), nil
}

// CheckPassword checks if the password matches the hash
func CheckPassword(password, hash string) bool {
	parts := strings.Split(hash, ":")
	if len(parts) != 2 {
		return false
	}

	salt, storedHash := parts[0], parts[1]
	computedHash := base64.StdEncoding.EncodeToString([]byte(password + salt))
	return computedHash == storedHash
}

// GenerateToken generates a JWT token for a user
func GenerateToken(user *data.User) (string, error) {
	now := time.Now()
	claims := &Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "hound",
			Subject:   fmt.Sprintf("%d", user.ID),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// RefreshToken refreshes a JWT token
func RefreshToken(tokenString string) (string, error) {
	claims, err := ValidateToken(tokenString)
	if err != nil {
		return "", err
	}

	// Get user from database
	user, err := data.GetUserByID(claims.UserID)
	if err != nil || user == nil {
		return "", errors.New("user not found")
	}

	return GenerateToken(user)
}

// GenerateCSRFToken generates a CSRF token
func GenerateCSRFToken() (string, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return "", fmt.Errorf("failed to generate CSRF token: %w", err)
	}
	return base64.StdEncoding.EncodeToString(token), nil
}

// InitJWTSecretFromEnv initializes JWT secret from environment variable
func InitJWTSecretFromEnv() {
	secret := os.Getenv("HOUND_JWT_SECRET")
	if secret != "" {
		SetJWTSecret(secret)
	} else {
		// Generate a default secret for development
		InitAuth("")
	}
}
