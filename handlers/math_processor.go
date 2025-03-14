package handlers

import (
    "regexp"
)

// preprocessMathExpressions replaces inline and display math expressions with tokens
// that won't be processed by the markdown parser, so they can be rendered as LaTeX
func preprocessMathExpressions(markdown string) string {
    // Handle display math ($$...$$)
    displayMathRegex := regexp.MustCompile(`\$\$([\s\S]*?)\$\$`)
    markdown = displayMathRegex.ReplaceAllStringFunc(markdown, func(match string) string {
        // Extract the math expression without the $$ delimiters
        math := match[2 : len(match)-2]
        // Create a placeholder that won't be processed by markdown
        return "<div class=\"math math-display\">$$" + math + "$$</div>"
    })
    
    // Handle inline math ($...$)
    inlineMathRegex := regexp.MustCompile(`\$([^\$\n]+?)\$`)
    markdown = inlineMathRegex.ReplaceAllStringFunc(markdown, func(match string) string {
        // Extract the math expression without the $ delimiters
        math := match[1 : len(match)-1]
        // Create a placeholder that won't be processed by markdown
        return "<span class=\"math math-inline\">$" + math + "$</span>"
    })
    
    return markdown
}

// addClassesToCodeBlocks adds CSS classes to <pre> and <code> tags
func addClassesToCodeBlocks(html string) string {
    // Add classes to <pre> tags
    preRegex := regexp.MustCompile(`<pre>`)
    html = preRegex.ReplaceAllString(html, `<pre class="hljs">`)
    
    // Add classes to <code> tags within <pre> tags if they don't have a class
    codeRegex := regexp.MustCompile(`<pre class="hljs"><code>`)
    html = codeRegex.ReplaceAllString(html, `<pre class="hljs"><code class="hljs">`)
    
    return html
}