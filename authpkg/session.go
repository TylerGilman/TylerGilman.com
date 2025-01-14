package authpkg

import (
    "encoding/gob"
    "log/slog"
    "net/http"
    "os"
    "time"
    "github.com/alexedwards/scs/v2"
)

var SessionManager *scs.SessionManager

// InitStore must be called after environment variables are loaded
func InitStore() {
    gob.Register(time.Time{})
    SessionManager = scs.New()
    
    // Configure session options
    SessionManager.Lifetime = 7 * 24 * time.Hour // 7 days
    SessionManager.Cookie.HttpOnly = true
    SessionManager.Cookie.Secure = os.Getenv("ENV") != "development"
    SessionManager.Cookie.SameSite = http.SameSiteStrictMode
    
    slog.Info("Session store initialized successfully")
}

func ClearUserSession(r *http.Request) error {
    SessionManager.Destroy(r.Context())
    return nil
}

func SetUserSession(r *http.Request) error {
    SessionManager.Put(r.Context(), "authenticated", true)
    SessionManager.Put(r.Context(), "last_active", time.Now())
    return nil
}

func IsAuthenticated(r *http.Request) bool {
    auth, ok := SessionManager.Get(r.Context(), "authenticated").(bool)
    if !ok {
        return false
    }
    
    // Check last active time
    lastActive, ok := SessionManager.Get(r.Context(), "last_active").(time.Time)
    if !ok || time.Since(lastActive) > 24*time.Hour {
        slog.Info("Session expired or invalid last active time")
        return false
    }
    
    return auth
}
