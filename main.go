package main

import (
	"crypto/tls"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joho/godotenv"

	"github.com/TylerGilman/nereus_main_site/handlers"
	"github.com/TylerGilman/nereus_main_site/views/blog"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file:", err)
	}

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

	// Static file handling
	router.Handle("/*", public())
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
	router.Get("/modal/user-profile", handlers.Make(handlers.HandleUserProfileModal))
	router.Get("/close-modal", handlers.Make(handlers.HandleCloseModal))
	router.Get("/home", handlers.Make(handlers.HandleHome))
	router.Get("/projects", handlers.Make(handlers.HandleProjects))
	router.Get("/blog", handlers.Make(handlers.HandleBlog))
	router.Get("/blog/search", handlers.Make(handlers.HandleSearch))
	router.Get("/blog/article/{id}", handlers.Make(handlers.HandleFullArticle))
	router.Get("/login", handlers.Make(handlers.HandleLoginIndex))

	// Load the Cloudflare Origin certificate and key
	cert, err := tls.LoadX509KeyPair("/etc/ssl/cloudflare/nereustechnology.net.pem", "/etc/ssh/cloudflare/nereustechnology.net.key")
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
		log.Fatal("Error starting HTTPS server:", err)
	}
}

func public() http.Handler {
	return http.FileServer(http.Dir("./public"))
}
