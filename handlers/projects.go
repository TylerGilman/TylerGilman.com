package handlers

import (
	"net/http"

	"github.com/TylerGilman/nereus_main_site/views/projects"
)

func HandleProjects(w http.ResponseWriter, r *http.Request) error {
	isHtmxRequest := r.Header.Get("HX-Request") == "true"
	if isHtmxRequest {
		return Render(w, r, projects.Partial())
	} else {
		return Render(w, r, projects.Projects())
	}
}
