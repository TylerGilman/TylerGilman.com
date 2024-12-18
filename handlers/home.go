package handlers

import (
	"net/http"

	"github.com/TylerGilman/nereus_main_site/authpkg"
	"github.com/TylerGilman/nereus_main_site/views/home"
)

func HandleHome(w http.ResponseWriter, r *http.Request) error {
    isAdmin := authpkg.IsAuthenticated(r)
    isHtmxRequest := r.Header.Get("HX-Request") == "true"

    if isHtmxRequest {
        return Render(w, r, home.Partial())
    }
    return Render(w, r, home.Index(isAdmin))
}
