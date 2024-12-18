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

func SetUserSession(w http.ResponseWriter, r *http.Request) error {
    session, err := store.Get(r, "auth-session")
    if err != nil {
        // Create a new session if there was an error getting the existing one
        session = sessions.NewSession(store, "auth-session")
    }
    
    session.Values["authenticated"] = true
    session.Values["last_active"] = time.Now()
    return session.Save(r, w)
}

func ClearUserSession(w http.ResponseWriter, r *http.Request) error {
    session, err := store.Get(r, "auth-session")
    if err != nil {
        return err
    }
    
    session.Options.MaxAge = -1 // This will delete the cookie
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
