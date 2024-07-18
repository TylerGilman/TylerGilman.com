package handlers

import (
	"net/http"

	"github.com/TylerGilman/nereus_main_site/views/auth"
)

func HandleLoginIndex(w http.ResponseWriter, r *http.Request) error {
	return Render(w, r, auth.Login())
}
