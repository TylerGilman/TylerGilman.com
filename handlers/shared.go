package handlers

import (
    "context"
    "log/slog"
    "net/http"
    "github.com/a-h/templ"
)

type HTTPHandler func(w http.ResponseWriter, r *http.Request) error

// Adapter decorator pattern
func Make(h HTTPHandler) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        if err := h(w, r); err != nil {
            slog.Error("HTTP handler error", "err", err, "path", r.URL.Path)
        }
    }
}

func Render(w http.ResponseWriter, r *http.Request, c templ.Component) error {
    return c.Render(r.Context(), w)
}

type contextKey string

const HtmxRequestKey contextKey = "HX-Request"

func setHtmxContext(r *http.Request) *http.Request {
    htmxRequest := r.Header.Get("HX-Request")
    ctx := context.WithValue(r.Context(), HtmxRequestKey, htmxRequest)
    return r.WithContext(ctx)
}

// New PageRenderer type and related functions
type PageRenderer struct {
    FullPage    templ.Component
    PartialPage templ.Component
}

func NewPageRenderer(full, partial templ.Component) *PageRenderer {
    return &PageRenderer{
        FullPage:    full,
        PartialPage: partial,
    }
}

func (pr *PageRenderer) Render(w http.ResponseWriter, r *http.Request) error {
    r = setHtmxContext(r)
    isHtmxRequest := r.Header.Get("HX-Request") == "true"
    
    if isHtmxRequest {
        return pr.PartialPage.Render(r.Context(), w)
    }
    return pr.FullPage.Render(r.Context(), w)
}

// Optional: Helper function that combines NewPageRenderer and Render
func RenderPage(w http.ResponseWriter, r *http.Request, full, partial templ.Component) error {
    return NewPageRenderer(full, partial).Render(w, r)
}
