package main

import (
	"crypto/tls"
	"log"
	"log/slog"
	"net/http"
	"time"
	"path/filepath"
	"github.com/go-chi/chi/v5"
	"os"
	"strings"
	"github.com/joho/godotenv"
	"github.com/TylerGilman/nereus_main_site/handlers"
	"github.com/TylerGilman/nereus_main_site/views/blog"
)

func init() {
	// Get the current working directory
	cwd, err := os.Getwd()
	if err != nil {
		log.Fatal("Error getting current working directory:", err)
	}

	// Construct the path to the .env file
	envPath := filepath.Join(cwd, ".env")

	// Check if .env file exists
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		log.Printf("Warning: .env file not found at %s\n", envPath)
	} else {
		// Load the .env file
		err = godotenv.Load(envPath)
		if err != nil {
			log.Printf("Error loading .env file from %s: %v\n", envPath, err)
		} else {
			log.Printf(".env file loaded successfully from %s\n", envPath)
		}
	}

	// Print all environment variables for debugging
	for _, env := range os.Environ() {
		log.Println(env)
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
		return slog.LevelInfo // Default to INFO if not specified or invalid
	}
}

func main() {
	// Get log level from environment variable
	logLevelStr := os.Getenv("LOG_LEVEL")
	if logLevelStr == "" {
		log.Println("LOG_LEVEL not set, defaulting to INFO")
		logLevelStr = "INFO"
	}
	logLevel := getLogLevel(logLevelStr)

	// ... [rest of the main function remains the same] ...

	// Create a JSON handler with the specified log level
	opts := &slog.HandlerOptions{
		Level: logLevel,
	}
	handler := slog.NewJSONHandler(os.Stdout, opts)
	logger := slog.New(handler)
	slog.SetDefault(logger)

	// Initialize the database
	if err := blog.InitDB(); err != nil {
		log.Fatal("Error initializing database:", err)
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
	router.Handle("/public/*", Public())

	// Check environment
	env := os.Getenv("ENV")
	if env == "" {
		log.Println("ENV not set, defaulting to production")
		env = "production"
	}

	if env == "development" {
		// Development server
		port := os.Getenv("DEV_PORT")
		if port == "" {
			log.Println("DEV_PORT not set, defaulting to 8080")
			port = "8080"
		}
		slog.Info("Starting development server", "port", port)
		if err := http.ListenAndServe(":"+port, router); err != nil {
			slog.Error("Error starting development server:", slog.String("error", err.Error()))
		}
	} else {
		// Production server
		certPath := os.Getenv("SSL_CERT_PATH")
		keyPath := os.Getenv("SSL_KEY_PATH")
		if certPath == "" || keyPath == "" {
			log.Fatal("SSL_CERT_PATH or SSL_KEY_PATH not set in environment")
		}

		cert, err := tls.LoadX509KeyPair(certPath, keyPath)
		if err != nil {
			log.Fatalf("Error loading certificate and key: %v", err)
		}

		// Configure the TLS
		tlsConfig := &tls.Config{
			Certificates: []tls.Certificate{cert},
			MinVersion:   tls.VersionTLS12, // Ensure minimum TLS 1.2
		}

		// Create a server with the TLS config
		server := &http.Server{
			Addr:      ":443", // HTTPS port
			Handler:   router,
			TLSConfig: tlsConfig,
		}

		// Start the HTTPS server
		slog.Info("HTTPS server starting", "listenAddr", server.Addr)
		if err := server.ListenAndServeTLS("", ""); err != nil {
			slog.Error("Error starting HTTPS server:", slog.String("error", err.Error()))
		}
	}
}
