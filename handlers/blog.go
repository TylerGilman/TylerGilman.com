package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/TylerGilman/nereus_main_site/views/blog"
	"github.com/go-chi/chi/v5"

	"github.com/a-h/templ"
)

func HandleBlog(w http.ResponseWriter, r *http.Request) error {
	r = setHtmxContext(r)
	isHtmxRequest := r.Header.Get("HX-Request") == "true"
	slog.Info("HX-Request", "value", r.Context().Value(HtmxRequestKey))

	mainArticles, err := blog.GetAllArticles()
	if err != nil {
		http.Error(w, "Failed to fetch articles", http.StatusInternalServerError)
		return err
	}

	sidebarArticles := mainArticles
	if len(sidebarArticles) > 7 {
		sidebarArticles = sidebarArticles[:7]
	}

	if isHtmxRequest {
		return Render(w, r, blog.Partial(mainArticles, sidebarArticles))
	} else {
		return Render(w, r, blog.Blog(mainArticles, sidebarArticles))
	}
}

func HandleFullArticle(w http.ResponseWriter, r *http.Request) error {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid article ID", http.StatusBadRequest)
		return err
	}

	article, _ := blog.GetArticleByID(id)
	if err != nil {
		http.Error(w, "Article not found", http.StatusNotFound)
		return err
	}
	return Render(w, r, blog.FullArticle(article))
}

func HandleSearch(w http.ResponseWriter, r *http.Request) error {
	query := r.URL.Query().Get("query")
	category := r.URL.Query().Get("category")

	searchResults, err := blog.SearchArticles(query, category)
	if err != nil {
		http.Error(w, "Search failed", http.StatusInternalServerError)
		return err
	}

	component := blog.MainArticles(searchResults)
	return Render(w, r, component)
}

func HandleAdminBlogPost(w http.ResponseWriter, r *http.Request) error {
	adminPass := r.URL.Query().Get("admin_pass")
	return Render(w, r, blog.AdminBlogPost(adminPass))
}

func HandleCreateBlogPost(w http.ResponseWriter, r *http.Request) error {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return err
	}

	adminPassword := r.FormValue("admin_pass")
	if adminPassword != "your_secure_password" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return errors.New("unauthorized access attempt")
	}
	newArticle := blog.Article{
		Title:    r.FormValue("title"),
		Author:   r.FormValue("author"),
		Date:     time.Now(),
		Summary:  r.FormValue("summary"),
		ImageUrl: r.FormValue("imageUrl"),
		Category: r.FormValue("category"),
		Content:  r.FormValue("content"),
	}

	_, err := blog.SaveArticle(newArticle)
	if err != nil {
		http.Error(w, "Failed to save article", http.StatusInternalServerError)
		return err
	}

	return Render(w, r, templ.Raw(`<div class="text-green-600">Blog post created successfully!</div>`))

}
