package handlers

import (
	"log/slog"
	"net/http"
)

func AdminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var adminPassword string

		if r.Method == "GET" {
			adminPassword = r.URL.Query().Get("admin_pass")
		} else if r.Method == "POST" {
			if err := r.ParseForm(); err != nil {
				http.Error(w, "Failed to parse form", http.StatusBadRequest)
				return
			}
			adminPassword = r.FormValue("admin_pass")
		}

		slog.Info("Request URL: %s", slog.String("URL", r.URL.String()))
		slog.Info("Request Method: %s", slog.String("method", r.Method))

		if adminPassword != "your_secure_password" {
			slog.Warn("Unauthorized admin access attempt")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		slog.Info("Admin access granted")
		next.ServeHTTP(w, r)
	})
}
