package handlers

import (
    "log/slog"
    "fmt"
    "net/http"
    "regexp"
    "strconv"
    "strings"
    "time"
    "github.com/TylerGilman/TylerGilman.com/views/blog"
    "github.com/go-chi/chi/v5"
    "github.com/gomarkdown/markdown"
    "github.com/gomarkdown/markdown/parser"
    "github.com/TylerGilman/TylerGilman.com/authpkg"
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
    
    // Get all categories for the dropdown
    categories, err := blog.GetAllCategories()
    if err != nil {
        slog.Error("Failed to fetch categories", "error", err)
        categories = []string{} // Continue with empty categories rather than failing
    }
    
    // Get recently updated articles for the sidebar
    recentArticles := mainArticles
    if len(recentArticles) > 5 {
        recentArticles = recentArticles[:5]
    }

    renderer := NewPageRenderer(
        blog.Blog(mainArticles, recentArticles, categories, isAdmin),
        blog.Partial(mainArticles, recentArticles, categories, isAdmin),
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
    
    // Get all categories for the category filter
    categories, err := blog.GetAllCategories()
    if err != nil {
        slog.Error("Failed to fetch categories for search", "error", err)
        categories = []string{} // Continue with empty categories rather than failing
    }
    
    // Show filtered results but keep the filter options available
    return Render(w, r, blog.SearchResults(searchResults, categories, category))
}

// HandleAdminBlogPage renders the blog editor page
func HandleAdminBlogPage(w http.ResponseWriter, r *http.Request) error {
    adminPass := r.URL.Query().Get("admin_pass")
    return Render(w, r, blog.AdminPage(adminPass))
}

// Helper function to process markdown content to HTML with proper math handling
func processMarkdownToHTML(markdownContent string) string {
    // First, extract and replace math expressions with unique placeholders
    mathPlaceholders := make(map[string]string)
    
    // Extract display math expressions ($$...$$)
    displayMathRegex := regexp.MustCompile(`\$\$([\s\S]*?)\$\$`)
    displayIndex := 0
    displayMarkdown := displayMathRegex.ReplaceAllStringFunc(markdownContent, func(match string) string {
        placeholder := fmt.Sprintf("DISPLAY_MATH_%d", displayIndex)
        mathPlaceholders[placeholder] = match
        displayIndex++
        return placeholder
    })
    
    // Extract inline math expressions ($...$)
    inlineMathRegex := regexp.MustCompile(`\$([^\$\n]+?)\$`)
    inlineIndex := 0
    processedMarkdown := inlineMathRegex.ReplaceAllStringFunc(displayMarkdown, func(match string) string {
        placeholder := fmt.Sprintf("INLINE_MATH_%d", inlineIndex)
        mathPlaceholders[placeholder] = match
        inlineIndex++
        return placeholder
    })
    
    // Create markdown parser with extensions
    extensions := parser.CommonExtensions | parser.AutoHeadingIDs
    p := parser.NewWithExtensions(extensions)
    
    // Parse markdown into AST
    doc := p.Parse([]byte(processedMarkdown))
    
    // Create HTML renderer with options
    htmlFlags := html.CommonFlags | html.HrefTargetBlank
    opts := html.RendererOptions{Flags: htmlFlags}
    renderer := html.NewRenderer(opts)
    
    // Render HTML
    htmlContent := string(markdown.Render(doc, renderer))
    
    // Replace placeholders with math expressions wrapped in appropriate HTML
    for placeholder, mathExpr := range mathPlaceholders {
        if strings.HasPrefix(placeholder, "DISPLAY_MATH_") {
            htmlContent = strings.Replace(htmlContent, placeholder, 
                fmt.Sprintf("<div class=\"math math-display\">%s</div>", mathExpr), -1)
        } else if strings.HasPrefix(placeholder, "INLINE_MATH_") {
            htmlContent = strings.Replace(htmlContent, placeholder, 
                fmt.Sprintf("<span class=\"math math-inline\">%s</span>", mathExpr), -1)
        }
    }
    
    return htmlContent
}

func HandleAdminBlogPost(w http.ResponseWriter, r *http.Request) error {
    if err := r.ParseForm(); err != nil {
        http.Error(w, "Failed to parse form", http.StatusBadRequest)
        return err
    }

    markdownContent := r.FormValue("content")
    
    // Process markdown to HTML
    htmlContent := processMarkdownToHTML(markdownContent)
    
    // Add a class to code blocks for styling
    htmlContent = addClassesToCodeBlocks(htmlContent)

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
    
    // Process markdown to HTML using our helper function
    htmlContent := processMarkdownToHTML(markdownContent)
    
    // Add classes to code blocks
    htmlContent = addClassesToCodeBlocks(htmlContent)

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

func HandleDeleteArticle(w http.ResponseWriter, r *http.Request) error {
    articleIDStr := chi.URLParam(r, "id")
    articleID, err := strconv.Atoi(articleIDStr)
    if err != nil {
        http.Error(w, "invalid id", http.StatusBadRequest)
        return err
    }

    // do the delete
    if err := blog.DeleteArticle(articleID); err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return err
    }

    // Now you want to set HX-Redirect for HTMX:
    w.Header().Set("HX-Redirect", "/blog")
    w.WriteHeader(http.StatusOK)
    return nil
}