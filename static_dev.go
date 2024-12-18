package main

import (
	"net/http"
)

func Public() http.Handler {
	return http.StripPrefix("/public/", http.FileServer(http.Dir("public")))
}
