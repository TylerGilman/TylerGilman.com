// pkg/content/markdown.go
package content

import (
    "github.com/gomarkdown/markdown"
    "github.com/gomarkdown/markdown/parser"
)

type Content struct {
    Markdown string
    HTML     string
}

func ProcessMarkdown(input string) (*Content, error) {
    extensions := parser.CommonExtensions | parser.AutoHeadingIDs
    parser := parser.NewWithExtensions(extensions)
    html := markdown.ToHTML([]byte(input), parser, nil)
    
    return &Content{
        Markdown: input,
        HTML:     string(html),
    }, nil
}
