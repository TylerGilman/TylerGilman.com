package handlers

import (
    "net/http"
    "github.com/TylerGilman/TylerGilman.com/authpkg"
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
