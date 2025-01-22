package blog

import (
    "database/sql"
    "time"
    "fmt"
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
    Category    string
    Content     string    // Markdown content
    HTMLContent string    // Rendered HTML
    ImageUrl    string
}

var db *sql.DB

const (
    selectAllColumns = `id, title, author, date, summary, category, content, html_content, image_url`
    insertColumns   = `title, author, date, summary, category, content, html_content, image_url`
)

func InitDB() error {
    dbPath := os.Getenv("DB_PATH")
    
    // Ensure full path exists
    if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
        return fmt.Errorf("failed to create database path: %v (UID: %d, GID: %d)", 
            err, os.Getuid(), os.Getgid())
    }
    // Ensure database directory exists
    if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
        return fmt.Errorf("failed to create database directory: %w", err)
    }

    // Create database file if it doesn't exist
    if _, err := os.Stat(dbPath); os.IsNotExist(err) {
        file, err := os.Create(dbPath)
        if err != nil {
            return fmt.Errorf("failed to create database file: %w", err)
        }
        file.Close()
    }

    // Open database with write permissions
    var err error
    db, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_fk=true&mode=rwc")
    if err != nil {
        return fmt.Errorf("failed to open database: %w", err)
    }

    // Create tables
    _, err = db.Exec(`
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
    if db != nil {
        db.Close()
    }
}

func UpdateArticle(article Article) error {
    _, err := db.Exec(`
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
    _, err := db.Exec(`DELETE FROM articles WHERE id = ?`, id)
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
    
    result, err := db.Exec(`
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
    rows, err := db.Query(`SELECT ` + selectAllColumns + ` FROM articles ORDER BY date DESC`)
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
        AND (? = '' OR category = ?)
        ORDER BY date DESC
    `
    rows, err := db.Query(sqlQuery, "%"+query+"%", "%"+query+"%", "%"+query+"%", category, category)
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

func GetRandomArticles(n int) ([]Article, error) {
    rows, err := db.Query(`SELECT `+selectAllColumns+` FROM articles ORDER BY RANDOM() LIMIT ?`, n)
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
    row := db.QueryRow(`SELECT `+selectAllColumns+` FROM articles WHERE id = ?`, id)
    return scanArticle(row)
}

func GetRelatedArticles(currentID int, category string, limit int) ([]Article, error) {
    rows, err := db.Query(`
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
