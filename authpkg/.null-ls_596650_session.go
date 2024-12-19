package authpkg

import (
    "crypto/rand"
    "encoding/base64"
    "fmt"
    "net/http"
    "os"
    "time"
    "encoding/gob"
    "log/slog"
    "github.com/gorilla/sessions"
)

var store *sessions.CookieStore

// InitStore must be called after environment variables are loaded
func InitStore() {
    // Register the time.Time type with gob
    gob.Register(time.Time{})
    
    key := getSessionKey()
    
    // Set up the store with the key
    store = sessions.NewCookieStore([]byte(key))
    
    // Configure session options
    store.Options = &sessions.Options{
        Path:     "/",
        MaxAge:   86400 * 7, // 7 days
        HttpOnly: true,
        Secure:   os.Getenv("ENV") != "development",
        SameSite: http.SameSiteStrictMode,
    }
    
    slog.Info("Session store initialized successfully")
}

func getSessionKey() string {
    key := os.Getenv("SESSION_KEY")
    if key == "" {
        slog.Error("SESSION_KEY not found in environment")
        // Load from backup location or generate new key
        if backupKey := loadBackupKey(); backupKey != "" {
            slog.Info("Using backup session key")
            return backupKey
        }
        
        newKey, err := generateRandomKey(32)
        if err != nil {
            panic(fmt.Sprintf("Failed to generate session key: %v", err))
        }
        slog.Warn("Generated new session key - add to environment", "key", newKey)
        // Save the new key as backup
        saveBackupKey(newKey)
        return newKey
    }
    slog.Info("Using session key from environment")
    return key
}

func generateRandomKey(length int) (string, error) {
    bytes := make([]byte, length)
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return base64.StdEncoding.EncodeToString(bytes), nil
}

// Add backup key management
func loadBackupKey() string {
    data, err := os.ReadFile(".session_key")
    if err != nil {
        return ""
    }
    return string(data)
}

func saveBackupKey(key string) {
    err := os.WriteFile(".session_key", []byte(key), 0600)
    if err != nil {
        slog.Error("Failed to save backup session key", "error", err)
    }
}

func ClearUserSession(w http.ResponseWriter, r *http.Request) error {
    session, err := store.Get(r, "auth-session")
    if err != nil {
        // If we can't get the session, create a new one to ensure we clear anything that might exist
        session = sessions.NewSession(store, "auth-session")
    }
    
    // Clear all values
    session.Values = make(map[interface{}]interface{})
    
    // Set the session to expire immediately
    session.Options.MaxAge = -1
    
    return session.Save(r, w)
}

func SetUserSession(w http.ResponseWriter, r *http.Request) error {
    if store == nil {
        return fmt.Errorf("session store not initialized")
    }

    session, err := store.Get(r, "auth-session")
    if err != nil {
        // If there's an error getting the session, create a new one
        session = sessions.NewSession(store, "auth-session")
    }
    
    session.Values["authenticated"] = true
    session.Values["last_active"] = time.Now()
    
    // Ensure proper session configuration
    session.Options = &sessions.Options{
        Path:     "/",
        MaxAge:   86400 * 7, // 7 days
        HttpOnly: true,
        Secure:   os.Getenv("ENV") != "development",
        SameSite: http.SameSiteStrictMode,
    }
    
    return session.Save(r, w)
}

func IsAuthenticated(r *http.Request) bool {
    if store == nil {
        slog.Error("Session store not initialized")
        return false
    }

    session, err := store.Get(r, "auth-session")
    if err != nil {
        slog.Error("Error getting session", "error", err)
        return false
    }
    
    auth, ok := session.Values["authenticated"].(bool)
    if !ok {
        return false
    }
    
    // Optional: Check last active time
    lastActive, ok := session.Values["last_active"].(time.Time)
    if !ok || time.Since(lastActive) > 24*time.Hour {
        slog.Info("Session expired or invalid last active time")
        return false
    }
    
    return auth
}
