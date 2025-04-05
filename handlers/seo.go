package handlers

import (
	"net/http"
)

// HandleRobotsTxt serves the robots.txt file
func HandleRobotsTxt(w http.ResponseWriter, r *http.Request) error {
	w.Header().Set("Content-Type", "text/plain")
	http.ServeFile(w, r, "public/robots.txt")
	return nil
}

// HandleSitemap serves the sitemap.xml file
func HandleSitemap(w http.ResponseWriter, r *http.Request) error {
	w.Header().Set("Content-Type", "application/xml")
	http.ServeFile(w, r, "public/sitemap.xml")
	return nil
}