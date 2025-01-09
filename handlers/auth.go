package handlers

import (
    "net/http"
    "crypto/subtle"
    "os"
    "log/slog"
    "github.com/TylerGilman/nereus_main_site/authpkg"
    authviews "github.com/TylerGilman/nereus_main_site/views/auth"
)

func HandleLogin(w http.ResponseWriter, r *http.Request) error {
    if r.Method == "GET" {
        return RenderPage(w, r, 
            authviews.LoginPage(),
            authviews.LoginPage(), // No partial currently
        )
    }

    username := r.FormValue("username")
    password := r.FormValue("password")
    validUsername := subtle.ConstantTimeCompare([]byte(username), []byte(os.Getenv("ADMIN_USERNAME"))) == 1
    validPassword := subtle.ConstantTimeCompare([]byte(password), []byte(os.Getenv("ADMIN_PASSWORD"))) == 1

    if validUsername && validPassword {
        if err := authpkg.SetUserSession(r); err != nil {
            slog.Error("Error setting session", "error", err)
            http.Error(w, "Error setting session", http.StatusInternalServerError)
            return err
        }
        http.Redirect(w, r, "/admin/blog", http.StatusSeeOther)
        return nil
    }

    return RenderPage(w, r, 
        authviews.LoginPage(),
        authviews.LoginPage(),
    )
}

func HandleLogout(w http.ResponseWriter, r *http.Request) error {
    if err := authpkg.ClearUserSession(r); err != nil {
        slog.Error("Error clearing session", "error", err)
    }
    
    // Security headers to prevent caching
    w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
    w.Header().Set("Pragma", "no-cache")
    w.Header().Set("Expires", "0")
    
    http.Redirect(w, r, "/", http.StatusSeeOther)
    return nil
}
