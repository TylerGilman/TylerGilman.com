package handlers

import (
    "context"
    "net/http"
    "github.com/TylerGilman/TylerGilman.com/authpkg"
)

// Context keys
const (
    UserIsAdminKey contextKey = "userIsAdmin"
)

func SessionMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Run the session manager
        handler := authpkg.SessionManager.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Add isAdmin to context for all routes
            isAdmin := authpkg.IsAuthenticated(r)
            ctx := context.WithValue(r.Context(), UserIsAdminKey, isAdmin)
            next.ServeHTTP(w, r.WithContext(ctx))
        }))
        
        handler.ServeHTTP(w, r)
    })
}

func AdminAuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !authpkg.IsAuthenticated(r) {
            http.Redirect(w, r, "/login", http.StatusSeeOther)
            return
        }
        next.ServeHTTP(w, r)
    })
}
