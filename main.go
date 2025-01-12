package main

import (
	"context"
	"crypto/tls"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/TylerGilman/nereus_main_site/handlers"
	"github.com/TylerGilman/nereus_main_site/views/blog"
	"github.com/TylerGilman/nereus_main_site/authpkg"
)

func init() {
	cwd, err := os.Getwd()
	if err != nil {
		log.Fatal("Error getting current working directory:", err)
	}

	envPath := filepath.Join(cwd, ".env")

	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		log.Printf("Warning: .env file not found at %s\n", envPath)
	} else {
		err = godotenv.Load(envPath)
		if err != nil {
			log.Printf("Error loading .env file from %s: %v\n", envPath, err)
		} else {
			log.Printf(".env file loaded successfully from %s\n", envPath)
		}
	}
}

func getLogLevel(levelStr string) slog.Level {
	switch strings.ToUpper(levelStr) {
	case "DEBUG":
		return slog.LevelDebug
	case "INFO":
		return slog.LevelInfo
	case "WARN":
		return slog.LevelWarn
	case "ERROR":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func setupRoutes(router *chi.Mux) {
	// Global middleware
  router.Use(middleware.Logger)
  router.Use(middleware.Recoverer)
  router.Use(middleware.RequestID)
  router.Use(middleware.RealIP)
  router.Use(handlers.SessionMiddleware) 

	// Auth routes
	router.Get("/login", handlers.Make(handlers.HandleLogin))
	router.Post("/login", handlers.Make(handlers.HandleLogin))
	router.Get("/logout", handlers.Make(handlers.HandleLogout))

router.Route("/admin", func(r chi.Router) {
    // Apply the admin middleware to all routes under /admin
    r.Use(handlers.AdminAuthMiddleware)
    
    // Blog management
    r.Route("/blog", func(r chi.Router) {
        r.Get("/", handlers.Make(handlers.HandleAdminBlogPage))
        r.Post("/", handlers.Make(handlers.HandleAdminBlogPost))
        r.Get("/edit/{id}", handlers.Make(handlers.HandleEditArticle))
        r.Put("/{id}", handlers.Make(handlers.HandleUpdateArticle))
        r.Delete("/{id}", handlers.Make(handlers.HandleDeleteArticle))
    })
})

	// Public routes
	router.Route("/", func(r chi.Router) {
		// Modal routes
		r.Route("/modal", func(mr chi.Router) {
			mr.Get("/more-options", handlers.Make(handlers.HandleOptionsModal))
			mr.Get("/notifications", handlers.Make(handlers.HandleNotificationsModal))
			mr.Get("/contact", handlers.Make(handlers.HandleContactModal))
			mr.Get("/close", handlers.Make(handlers.HandleCloseModal))
		})

		// Blog routes
		r.Route("/blog", func(br chi.Router) {
			br.Get("/", handlers.Make(handlers.HandleBlog))
			br.Get("/search", handlers.Make(handlers.HandleSearch))
			br.Get("/article/{id}", handlers.Make(handlers.HandleFullArticle))
		})

		// Core pages
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "/home", http.StatusMovedPermanently)
		})
		r.Get("/home", handlers.Make(handlers.HandleHome))
		r.Get("/projects", handlers.Make(handlers.HandleProjects))
	})

	// Static files
  router.Handle("/public/*", Public())
}

func main() {
    // Load environment variables first
    if err := godotenv.Load(); err != nil {
        slog.Error("Error loading .env file", "error", err)
    }
    
    // Initialize the session store after environment is loaded
    authpkg.InitStore()
    logLevelStr := os.Getenv("LOG_LEVEL")
    if logLevelStr == "" {
        log.Println("LOG_LEVEL not set, defaulting to INFO")
        logLevelStr = "INFO"
    }
    logLevel := getLogLevel(logLevelStr)

    opts := &slog.HandlerOptions{
        Level: logLevel,
    }
    handler := slog.NewJSONHandler(os.Stdout, opts)
    logger := slog.New(handler)
    slog.SetDefault(logger)

    if err := blog.InitDB(); err != nil {
        log.Fatal("Error initializing database:", err)
    }
    defer blog.CloseDB()

    // Initial projects cache update
    handlers.UpdateProjectsCache()

    // Set up periodic cache update
    go func() {
        for {
            time.Sleep(1 * time.Hour)
            handlers.UpdateProjectsCache()
        }
    }()

    router := chi.NewMux()
    setupRoutes(router)

    // Graceful shutdown setup
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    srv := &http.Server{
        Handler:      router,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    // Start server
    go func() {
        port := os.Getenv("DEV_PORT")
        if port == "" {
            port = "8080"
        }
        srv.Addr = ":" + port
        
        // No need for SSL here since Nginx handles it
        slog.Info("Starting server", "port", port)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            slog.Error("Error starting server:", slog.String("error", err.Error()))
        }
    }()

    <-quit
    slog.Info("Server is shutting down...")

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        slog.Error("Server forced to shutdown:", slog.String("error", err.Error()))
    }

    slog.Info("Server exited properly")
}
