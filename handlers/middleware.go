package handlers

import (
	"log/slog"
	"net/http"
  "os"
  "time"
)

func AdminAuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        var adminPassword string

        if r.Method == "GET" {
            // Don't log the actual password value
            adminPassword = r.URL.Query().Get("admin_pass")
            slog.Info("Admin access attempt", 
                "method", "GET",
                "path", r.URL.Path,
                "remote_addr", r.RemoteAddr)
        } else if r.Method == "POST" {
            if err := r.ParseForm(); err != nil {
                http.Error(w, "Failed to parse form", http.StatusBadRequest)
                return
            }
            adminPassword = r.FormValue("admin_pass")
            slog.Info("Admin access attempt", 
                "method", "POST",
                "path", r.URL.Path,
                "remote_addr", r.RemoteAddr)
        }

        if adminPassword != os.Getenv("ADMIN_PASSWORD") {
            slog.Warn("Unauthorized admin access attempt",
                "path", r.URL.Path,
                "remote_addr", r.RemoteAddr,
                "timestamp", time.Now().Format(time.RFC3339))
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        slog.Info("Admin access granted",
            "path", r.URL.Path,
            "remote_addr", r.RemoteAddr)
        next.ServeHTTP(w, r)
    })
}
