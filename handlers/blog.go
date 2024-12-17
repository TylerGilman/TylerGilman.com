package handlers

import (
    "log/slog"
    "net/http"
    "strconv"
    "time"
    "github.com/TylerGilman/nereus_main_site/views/blog"
    "github.com/go-chi/chi/v5"
    "github.com/gomarkdown/markdown"
    "github.com/gomarkdown/markdown/parser"
    "github.com/gomarkdown/markdown/html"
)

// HandleBlog handles the blog listing page
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
    }
    return Render(w, r, blog.Blog(mainArticles, sidebarArticles))
}

// HandleFullArticle displays a single article
func HandleFullArticle(w http.ResponseWriter, r *http.Request) error {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.Atoi(idStr)
    if err != nil {
        http.Error(w, "Invalid article ID", http.StatusBadRequest)
        return err
    }

    article, err := blog.GetArticleByID(id)
    if err != nil {
        http.Error(w, "Article not found", http.StatusNotFound)
        return err
    }

    return Render(w, r, blog.FullArticle(article))
}

// HandleSearch handles article search functionality
func HandleSearch(w http.ResponseWriter, r *http.Request) error {
    query := r.URL.Query().Get("query")
    category := r.URL.Query().Get("category")

    searchResults, err := blog.SearchArticles(query, category)
    if err != nil {
        http.Error(w, "Search failed", http.StatusInternalServerError)
        return err
    }

    return Render(w, r, blog.MainArticles(searchResults))
}

// HandleAdminBlogPage renders the blog editor page
func HandleAdminBlogPage(w http.ResponseWriter, r *http.Request) error {
    adminPass := r.URL.Query().Get("admin_pass")
    return Render(w, r, blog.AdminPage(adminPass))
}

func HandleAdminBlogPost(w http.ResponseWriter, r *http.Request) error {
    if err := r.ParseForm(); err != nil {
        http.Error(w, "Failed to parse form", http.StatusBadRequest)
        return err
    }

    markdownContent := r.FormValue("content")
    
    // Create markdown parser with extensions
    extensions := parser.CommonExtensions | parser.AutoHeadingIDs
    p := parser.NewWithExtensions(extensions)
    
    // Parse markdown into AST
    doc := p.Parse([]byte(markdownContent))
    
    // Create HTML renderer with options
    htmlFlags := html.CommonFlags | html.HrefTargetBlank
    opts := html.RendererOptions{Flags: htmlFlags}
    renderer := html.NewRenderer(opts)
    
    // Render HTML
    htmlContent := string(markdown.Render(doc, renderer))

    newArticle := blog.Article{
        Title:       r.FormValue("title"),
        Author:      r.FormValue("author"),
        Date:        time.Now(),
        Summary:     r.FormValue("summary"),
        Category:    r.FormValue("category"),
        Content:     markdownContent,
        HTMLContent: htmlContent,
    }

    _, err := blog.SaveArticle(newArticle)
    if err != nil {
        slog.Error("Failed to save article", "error", err)
        http.Error(w, "Failed to save article", http.StatusInternalServerError)
        return err
    }

    return Render(w, r, blog.AdminSuccess())
}
