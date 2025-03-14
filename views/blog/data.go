package blog

import (
    "database/sql"
    "time"
    "fmt"
    "sort"
    "strings"
    _ "github.com/mattn/go-sqlite3"
    "os"
    "path/filepath"
)

type Article struct {
    ID          int
    Title       string
    Author      string
    Date        time.Time
    Summary     string
    Category    string    // Comma-separated categories
    Content     string    // Markdown content
    HTMLContent string    // Rendered HTML
    ImageUrl    string
}

// GetCategories returns the article's categories as a slice
func (a *Article) GetCategories() []string {
    if a.Category == "" {
        return []string{}
    }
    
    categories := []string{}
    for _, cat := range strings.Split(a.Category, ",") {
        trimmed := strings.TrimSpace(cat)
        if trimmed != "" {
            categories = append(categories, trimmed)
        }
    }
    return categories
}

var DB *sql.DB

const (
    selectAllColumns = `id, title, author, date, summary, category, content, html_content, image_url`
    insertColumns   = `title, author, date, summary, category, content, html_content, image_url`
)

func InitDB() error {
    dbPath := os.Getenv("DB_PATH")
    
    // Use absolute path verification
    absPath, err := filepath.Abs(dbPath)
    if err != nil {
        return fmt.Errorf("path resolution failed: %v", err)
    }

    // Create only the necessary directory
    dataDir := filepath.Dir(absPath)
    if err := os.MkdirAll(dataDir, 0755); err != nil {
        return fmt.Errorf("failed to create directory '%s': %v", dataDir, err)
    }

    // Create empty database file
    if _, err := os.Stat(absPath); os.IsNotExist(err) {
        if _, err := os.Create(absPath); err != nil {
            return fmt.Errorf("failed to create database file: %v", err)
        }
    }

    // Open database
    var dbErr error
    DB, dbErr = sql.Open("sqlite3", absPath+"?_journal_mode=WAL")
    if dbErr != nil {
        return fmt.Errorf("database connection failed: %v", dbErr)
    }

    // Test the connection
    if err := DB.Ping(); err != nil {
        return fmt.Errorf("database ping failed: %v", err)
    }

    // Create tables
    _, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            date DATETIME NOT NULL,
            summary TEXT,
            category TEXT,
            content TEXT NOT NULL,
            html_content TEXT NOT NULL,
            image_url TEXT
        )
    `)
    if err != nil {
        return fmt.Errorf("failed to create table: %w", err)
    }
    
    return nil
}

func CloseDB() {
    if DB != nil {
        DB.Close()
    }
}

func UpdateArticle(article Article) error {
    _, err := DB.Exec(`
        UPDATE articles 
        SET title = ?, author = ?, date = ?, summary = ?, 
            category = ?, content = ?, html_content = ?, image_url = ?
        WHERE id = ?
    `, article.Title, article.Author, article.Date.UTC().Format(time.RFC3339),
       article.Summary, article.Category, article.Content, article.HTMLContent,
       article.ImageUrl, article.ID)
    return err
}

func DeleteArticle(id int) error {
    _, err := DB.Exec(`DELETE FROM articles WHERE id = ?`, id)
    return err
}

func scanArticle(row interface{}) (Article, error) {
    var article Article
    var dateStr string
    var scanner func(...interface{}) error

    switch r := row.(type) {
    case *sql.Row:
        scanner = r.Scan
    case *sql.Rows:
        scanner = r.Scan
    default:
        return Article{}, fmt.Errorf("unsupported row type")
    }

    err := scanner(
        &article.ID,
        &article.Title,
        &article.Author,
        &dateStr,
        &article.Summary,
        &article.Category,
        &article.Content,
        &article.HTMLContent,
        &article.ImageUrl,
    )
    if err != nil {
        return Article{}, err
    }

    // Try parsing with different formats
    var parseErr error
    formats := []string{
        "2006-01-02 15:04:05",
        time.RFC3339,     // Format like "2024-12-17T17:14:30Z"
        "2006-01-02T15:04:05Z",
    }

    for _, format := range formats {
        parsedDate, err := time.Parse(format, dateStr)
        if err == nil {
            article.Date = parsedDate.Local()
            return article, nil
        }
        parseErr = err
    }

    return Article{}, fmt.Errorf("error parsing date '%s': %v", dateStr, parseErr)
}

func SaveArticle(article Article) (int64, error) {
    if article.Date.IsZero() {
        article.Date = time.Now()
    }
    
    // Store date in RFC3339 format
    dateStr := article.Date.UTC().Format(time.RFC3339)
    
    result, err := DB.Exec(`
        INSERT INTO articles (`+insertColumns+`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, article.Title, article.Author, dateStr, article.Summary, 
       article.Category, article.Content, article.HTMLContent, article.ImageUrl)
    if err != nil {
        return 0, err
    }
    return result.LastInsertId()
}

func GetAllArticles() ([]Article, error) {
    rows, err := DB.Query(`SELECT ` + selectAllColumns + ` FROM articles ORDER BY date DESC`)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var articles []Article
    for rows.Next() {
        article, err := scanArticle(rows)
        if err != nil {
            return nil, err
        }
        articles = append(articles, article)
    }
    return articles, nil
}

func SearchArticles(query string, category string) ([]Article, error) {
    sqlQuery := `
        SELECT ` + selectAllColumns + ` FROM articles 
        WHERE (title LIKE ? OR summary LIKE ? OR content LIKE ?) 
        AND (? = '' OR category LIKE ?)
        ORDER BY date DESC
    `
    // We use LIKE with wildcards for category to support comma-separated list
    categoryParam := "%"
    if category != "" {
        categoryParam = "%" + category + "%"
    }
    
    rows, err := DB.Query(sqlQuery, "%"+query+"%", "%"+query+"%", "%"+query+"%", category, categoryParam)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var articles []Article
    for rows.Next() {
        article, err := scanArticle(rows)
        if err != nil {
            return nil, err
        }
        articles = append(articles, article)
    }
    return articles, nil
}

// GetAllCategories returns a list of all unique categories used across articles
func GetAllCategories() ([]string, error) {
    rows, err := DB.Query(`SELECT DISTINCT category FROM articles`)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    categoryMap := make(map[string]bool)
    for rows.Next() {
        var categoryList string
        if err := rows.Scan(&categoryList); err != nil {
            return nil, err
        }
        
        // Process comma-separated categories
        for _, cat := range strings.Split(categoryList, ",") {
            trimmed := strings.TrimSpace(cat)
            if trimmed != "" {
                categoryMap[trimmed] = true
            }
        }
    }
    
    // Convert map keys to slice
    categories := make([]string, 0, len(categoryMap))
    for cat := range categoryMap {
        categories = append(categories, cat)
    }
    
    // Sort categories alphabetically
    sort.Strings(categories)
    
    return categories, nil
}

func GetRandomArticles(n int) ([]Article, error) {
    rows, err := DB.Query(`SELECT `+selectAllColumns+` FROM articles ORDER BY RANDOM() LIMIT ?`, n)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var articles []Article
    for rows.Next() {
        article, err := scanArticle(rows)
        if err != nil {
            return nil, err
        }
        articles = append(articles, article)
    }
    return articles, nil
}

func GetArticleByID(id int) (Article, error) {
    row := DB.QueryRow(`SELECT `+selectAllColumns+` FROM articles WHERE id = ?`, id)
    return scanArticle(row)
}

func GetRelatedArticles(currentID int, category string, limit int) ([]Article, error) {
    rows, err := DB.Query(`
        SELECT `+selectAllColumns+` FROM articles 
        WHERE id != ? AND category = ?
        ORDER BY RANDOM()
        LIMIT ?
    `, currentID, category, limit)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var articles []Article
    for rows.Next() {
        article, err := scanArticle(rows)
        if err != nil {
            return nil, err
        }
        articles = append(articles, article)
    }
    return articles, nil
}
