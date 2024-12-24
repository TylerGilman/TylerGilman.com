package handlers

import (
    "log/slog"
    "fmt"
    "net/http"
    "strconv"
    "time"
    "github.com/TylerGilman/nereus_main_site/views/blog"
    "github.com/TylerGilman/nereus_main_site/views/components"
    "github.com/go-chi/chi/v5"
    "github.com/gomarkdown/markdown"
    "github.com/gomarkdown/markdown/parser"
    "github.com/TylerGilman/nereus_main_site/authpkg"
    "github.com/gomarkdown/markdown/html"
)

func HandleBlog(w http.ResponseWriter, r *http.Request) error {
    r = setHtmxContext(r)
    isAdmin := authpkg.IsAuthenticated(r)
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

    renderer := NewPageRenderer(
        blog.Blog(mainArticles, sidebarArticles, isAdmin),
        blog.Partial(mainArticles, sidebarArticles),
    )

    return renderer.Render(w, r)
}

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

    isAdmin := authpkg.IsAuthenticated(r)
    return Render(w, r, blog.FullArticle(article, isAdmin))
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

// For editing articles
func HandleEditArticle(w http.ResponseWriter, r *http.Request) error {
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

    return Render(w, r, blog.EditPage(article))
}

// For updating existing articles
func HandleUpdateArticle(w http.ResponseWriter, r *http.Request) error {
    if err := r.ParseForm(); err != nil {
        http.Error(w, "Failed to parse form", http.StatusBadRequest)
        return err
    }

    idStr := chi.URLParam(r, "id")
    id, err := strconv.Atoi(idStr)
    if err != nil {
        http.Error(w, "Invalid article ID", http.StatusBadRequest)
        return err
    }

    markdownContent := r.FormValue("content")
    extensions := parser.CommonExtensions | parser.AutoHeadingIDs
    p := parser.NewWithExtensions(extensions)
    doc := p.Parse([]byte(markdownContent))
    htmlFlags := html.CommonFlags | html.HrefTargetBlank
    opts := html.RendererOptions{Flags: htmlFlags}
    renderer := html.NewRenderer(opts)
    htmlContent := string(markdown.Render(doc, renderer))

    article := blog.Article{
        ID:          id,
        Title:       r.FormValue("title"),
        Author:      r.FormValue("author"),
        Date:        time.Now(),
        Summary:     r.FormValue("summary"),
        Category:    r.FormValue("category"),
        Content:     markdownContent,
        HTMLContent: htmlContent,
    }

    err = blog.UpdateArticle(article)
    if err != nil {
        http.Error(w, "Failed to update article", http.StatusInternalServerError)
        return err
    }

    http.Redirect(w, r, fmt.Sprintf("/blog/article/%d", id), http.StatusSeeOther)
    return nil
}

// For deleting articles
func HandleDeleteArticle(w http.ResponseWriter, r *http.Request) error {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.Atoi(idStr)
    if err != nil {
        http.Error(w, "Invalid article ID", http.StatusBadRequest)
        return err
    }

    err = blog.DeleteArticle(id)
    if err != nil {
        http.Error(w, "Failed to delete article", http.StatusInternalServerError)
        return err
    }

    http.Redirect(w, r, fmt.Sprintf("/blog"))
}
