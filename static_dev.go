// This file provides the static file handling for development mode
package main

import (
	"net/http"
	"path/filepath"
	"strings"
)

// FileServerWithMIMETypes wraps http.FileServer to set proper MIME types
type FileServerWithMIMETypes struct {
	handler http.Handler
}

func (fs *FileServerWithMIMETypes) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Set the correct MIME type based on file extension
	path := r.URL.Path
	ext := strings.ToLower(filepath.Ext(path))
	
	switch ext {
	case ".js":
		w.Header().Set("Content-Type", "application/javascript")
	case ".json":
		w.Header().Set("Content-Type", "application/json")
	case ".css":
		w.Header().Set("Content-Type", "text/css")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".woff", ".woff2":
		w.Header().Set("Content-Type", "font/"+ext[1:])
	}
	
	// Serve the file
	fs.handler.ServeHTTP(w, r)
}

// Public returns a handler for serving static files from the public directory
func Public() http.Handler {
	fileServer := http.FileServer(http.Dir("public"))
	return http.StripPrefix("/public/", &FileServerWithMIMETypes{handler: fileServer})
}
