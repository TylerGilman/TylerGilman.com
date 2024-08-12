package main

import (
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
	"crypto/tls"

	"github.com/go-chi/chi/v5"
	"github.com/joho/godotenv"
	"github.com/TylerGilman/nereus_main_site/handlers"
	"github.com/TylerGilman/nereus_main_site/views/blog"
)

func init() {
	if err := godotenv.Load(); err != nil {
		log.Println("Error loading .env file:", err)
	}
	log.Println("ENV:", os.Getenv("ENV"))
	log.Println("LOG_LEVEL:", os.Getenv("LOG_LEVEL"))
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
		return slog.LevelInfo // Default to INFO if not specified or invalid
	}
}

func main() {
	// Get log level from environment variable
	logLevelStr := os.Getenv("LOG_LEVEL")
	logLevel := getLogLevel(logLevelStr)

	// Create a JSON handler with the specified log level
	opts := &slog.HandlerOptions{
		Level: logLevel,
	}
	handler := slog.NewJSONHandler(os.Stdout, opts)
	logger := slog.New(handler)
	slog.SetDefault(logger)

	// Initialize the database
	if err := blog.InitDB(); err != nil {
		slog.Error("Error initializing database", "error", err)
		os.Exit(1)
	}
	defer blog.CloseDB() // Ensure the database connection is closed when the program exits

	// Set up the router
	router := chi.NewMux()
	handlers.UpdateProjectsCache()

	// Set up periodic cache update
	go func() {
		for {
			time.Sleep(1 * time.Hour)
			handlers.UpdateProjectsCache()
		}
	}()

	// Set up routes
	setupRoutes(router)

	// Determine whether to run in development or production mode
	env := os.Getenv("ENV")
	slog.Info("Current environment", "ENV", env)

	switch env {
	case "development":
		runDevelopmentServer(router)
	case "production":
		runProductionServer(router)
	default:
		slog.Error("Invalid ENV value. Please set ENV to either 'development' or 'production'")
		os.Exit(1)
	}
}

func setupRoutes(router chi.Router) {
	// Redirect "/" to "/home"
	router.Get("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/home", http.StatusMovedPermanently)
	})

	adminRouter := chi.NewRouter()
	adminRouter.Use(handlers.AdminAuthMiddleware)
	adminRouter.Get("/blog", handlers.Make(handlers.HandleAdminBlogPost))
	adminRouter.Post("/blog/create", handlers.Make(handlers.HandleCreateBlogPost))
	router.Mount("/admin", adminRouter)

	// Public routes
	router.Get("/modal/more-options", handlers.Make(handlers.HandleOptionsModal))
	router.Get("/modal/notifications", handlers.Make(handlers.HandleNotificationsModal))
	router.Get("/modal/contact", handlers.Make(handlers.HandleContactModal))
	router.Get("/close-modal", handlers.Make(handlers.HandleCloseModal))
	router.Get("/home", handlers.Make(handlers.HandleHome))
	router.Get("/projects", handlers.Make(handlers.HandleProjects))
	router.Get("/blog", handlers.Make(handlers.HandleBlog))
	router.Get("/blog/search", handlers.Make(handlers.HandleSearch))
	router.Get("/blog/article/{id}", handlers.Make(handlers.HandleFullArticle))
	router.Get("/login", handlers.Make(handlers.HandleLoginIndex))

	// Static file handling
	router.Handle("/public/*", http.StripPrefix("/public/", http.FileServer(http.Dir("public"))))
}

func runDevelopmentServer(router chi.Router) {
	addr := ":8080" // Use a different port for development
	slog.Info("Development server starting", "listenAddr", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		slog.Error("Error starting development server", "error", err)
	}
}

func runProductionServer(router chi.Router) {
	slog.Info("Attempting to run production server")
	cert, err := tls.LoadX509KeyPair("/home/tgilman/etc/ssl/cloudflare/nereustechnology.net.pem", "/home/tgilman/etc/ssl/cloudflare/nereustechnology.net.key")
	if err != nil {
		log.Fatalf("Error loading certificate and key: %v", err)
	}
	// configure TLS
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion: tls.VersionTLS12,
	}
	server := &http.Server{
		Addr: ":433", // HTTPS
		Handler: router,
		TLSConfig: tlsConfig,
	}
	slog.Info("HTTPS server starting", "listenAddr", server.Addr)
	if err := server.ListenAndServeTLS("", ""); err != nil {
		slog.Error("Error starting HTTPS server:", slog.String("error", err.Error()))
	}

}
