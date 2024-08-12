package main

import (
	"net/http"
	"os"
)

func Public() http.Handler {
	return http.StripPrefix("/public/", http.FileServerFS(os.DirFS("public")))
}
