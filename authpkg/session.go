package authpkg

import (
    "crypto/rand"
    "encoding/base64"
    "fmt"
    "net/http"
    "os"
    "time"
    "encoding/gob"
    "github.com/gorilla/sessions"
)

var store *sessions.CookieStore

func init() {
    // Register the time.Time type with gob
    gob.Register(time.Time{})
    
    // Set up the store with a proper key
    store = sessions.NewCookieStore([]byte(getSessionKey()))
    
    // Configure session options
    store.Options = &sessions.Options{
        Path:     "/",
        MaxAge:   86400 * 7, // 7 days
        HttpOnly: true,
        Secure:   os.Getenv("ENV") != "development", // Only secure in production
        SameSite: http.SameSiteStrictMode,
    }
}

func getSessionKey() string {
    key := os.Getenv("SESSION_KEY")
    if key == "" {
        // Generate a random key if one doesn't exist
        newKey, err := generateRandomKey(32)
        if err != nil {
            panic(fmt.Sprintf("Failed to generate session key: %v", err))
        }
        fmt.Printf("WARNING: Generated new session key: %s\nAdd this to your .env file as SESSION_KEY\n", newKey)
        return newKey
    }
    return key
}

func generateRandomKey(length int) (string, error) {
    bytes := make([]byte, length)
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return base64.StdEncoding.EncodeToString(bytes), nil
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
    session, err := store.Get(r, "auth-session")
    if err != nil {
        return false
    }
    
    auth, ok := session.Values["authenticated"].(bool)
    if !ok {
        return false
    }
    
    // Optional: Check last active time
    lastActive, ok := session.Values["last_active"].(time.Time)
    if !ok || time.Since(lastActive) > 24*time.Hour {
        return false
    }
    
    return auth
}
