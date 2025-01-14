package handlers

import (
	"net/http"

	"github.com/TylerGilman/TylerGilman.com/authpkg"
	"github.com/TylerGilman/TylerGilman.com/views/home"
)

func HandleHome(w http.ResponseWriter, r *http.Request) error {
    isAdmin := authpkg.IsAuthenticated(r)

    renderer := NewPageRenderer(
        home.Index(isAdmin),
        home.Partial(),
    )

    return renderer.Render(w, r)
}
