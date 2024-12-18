package handlers

import (
    "net/http"
    "github.com/TylerGilman/nereus_main_site/authpkg"
)

func SessionMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if authpkg.IsAuthenticated(r) {
            session, _ := authpkg.GetStore().Get(r, "auth-session")
            session.Values["last_active"] = time.Now()
            session.Save(r, w)
        }
        next.ServeHTTP(w, r)
    })
}
