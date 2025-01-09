package handlers

import (
    "net/http"
    "log/slog"
    "github.com/TylerGilman/nereus_main_site/authpkg"
)

func SessionMiddleware(next http.Handler) http.Handler {
    return authpkg.SessionManager.LoadAndSave(next)
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
