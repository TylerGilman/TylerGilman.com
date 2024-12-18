package handlers

import (
    "net/http"
    "crypto/subtle"
    "os"
    "github.com/TylerGilman/nereus_main_site/authpkg"
    authviews "github.com/TylerGilman/nereus_main_site/views/auth"
)

func HandleLogin(w http.ResponseWriter, r *http.Request) error {
    if r.Method == "GET" {
        return Render(w, r, authviews.LoginPage())
    }

    username := r.FormValue("username")
    password := r.FormValue("password")

    // Compare with environment variables using constant-time comparison
    validUsername := subtle.ConstantTimeCompare([]byte(username), []byte(os.Getenv("ADMIN_USERNAME"))) == 1
    validPassword := subtle.ConstantTimeCompare([]byte(password), []byte(os.Getenv("ADMIN_PASSWORD"))) == 1

    if validUsername && validPassword {
        if err := authpkg.SetUserSession(w, r); err != nil {
            http.Error(w, "Error setting session", http.StatusInternalServerError)
            return err
        }
        http.Redirect(w, r, "/admin/blog", http.StatusSeeOther)
        return nil
    }

    return Render(w, r, authviews.LoginPage())
}

func HandleLogout(w http.ResponseWriter, r *http.Request) error {
    if err := authpkg.ClearUserSession(w, r); err != nil {
        http.Error(w, "Error clearing session", http.StatusInternalServerError)
        return err
    }
    http.Redirect(w, r, "/", http.StatusSeeOther)
    return nil
}
