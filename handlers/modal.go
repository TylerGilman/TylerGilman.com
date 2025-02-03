package handlers

import (
	"net/http"

	"github.com/TylerGilman/TylerGilman.com/views/components"
)

func HandleOptionsModal(w http.ResponseWriter, r *http.Request) error {
	w.Header().Set("Content-Type", "text/html")
	isHtmxRequest := r.Header.Get("HX-Request") == "true"
	return Render(w, r, components.Modal(components.OptionsModalContent(), !isHtmxRequest))
}

func HandleNotificationsModal(w http.ResponseWriter, r *http.Request) error {
	w.Header().Set("Content-Type", "text/html")
	isHtmxRequest := r.Header.Get("HX-Request") == "true"
	return Render(w, r, components.Modal(components.NotificationsModalContent(), !isHtmxRequest))
}

func HandleContactModal(w http.ResponseWriter, r *http.Request) error {
    isHtmxRequest := r.Header.Get("HX-Request") == "true"
    return Render(w, r, components.Modal(components.ContactModalContent(), !isHtmxRequest))
}

func HandleCloseModal(w http.ResponseWriter, r *http.Request) error {
    w.Header().Set("Content-Type", "text/html")
    w.Header().Set("HX-Trigger", "modalClosed")
    // Return completely empty response to properly clear modal
    return nil
}
