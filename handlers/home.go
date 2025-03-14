package handlers

import (
	"net/http"

	"github.com/TylerGilman/TylerGilman.com/views/home"
)

// HandleHome returns the home page.
func HandleHome(w http.ResponseWriter, r *http.Request) error {
	r = setHtmxContext(r)
	isAdmin := isUserAdmin(r)
	isHtmxRequest := r.Header.Get("HX-Request") == "true"
	
	if isHtmxRequest {
		return home.Partial().Render(r.Context(), w)
	}
	
	err := home.Index(isAdmin).Render(r.Context(), w)
	if err != nil {
		http.Error(w, "Failed to render home page", http.StatusInternalServerError)
		return err
	}
	return nil
}

// HandleHomeFull returns the standalone home page with ThreeJS
func HandleHomeFull(w http.ResponseWriter, r *http.Request) error {
	isAdmin := isUserAdmin(r)
	err := home.StandaloneFull(isAdmin).Render(r.Context(), w)
	if err != nil {
		http.Error(w, "Failed to render home page", http.StatusInternalServerError)
		return err
	}
	return nil
}

// isUserAdmin checks if the current user is an admin
func isUserAdmin(r *http.Request) bool {
	isAdmin, ok := r.Context().Value(UserIsAdminKey).(bool)
	if !ok {
		return false
	}
	return isAdmin
}