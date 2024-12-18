package handlers

import (
    "net/http"
    "log/slog"
    "github.com/TylerGilman/nereus_main_site/authpkg"
)

func SessionMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if authpkg.IsAuthenticated(r) {
            if err := authpkg.SetUserSession(w, r); err != nil {
                slog.Error("Error refreshing session", "error", err)
            }
        }
        next.ServeHTTP(w, r)
    })
}

func AdminAuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !authpkg.IsAuthenticated(r) {
            slog.Info("Unauthorized access attempt to admin route", 
                "path", r.URL.Path,
                "remote_addr", r.RemoteAddr)
            http.Redirect(w, r, "/login", http.StatusSeeOther)
            return
        }
        next.ServeHTTP(w, r)
    })
}
