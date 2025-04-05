package handlers

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/TylerGilman/TylerGilman.com/authpkg"
	"github.com/TylerGilman/TylerGilman.com/views/models"
	"github.com/TylerGilman/TylerGilman.com/views/projects"
)

var (
	cachedFullPage        []byte
	cachedPartialPage     []byte
	cacheMutex            sync.RWMutex
	fullPageExpiration    time.Time
	partialPageExpiration time.Time
)

func UpdateProjectsCache() {
	slog.Info("Updating projects cache...")
	startTime := time.Now()

	// Use a timeout context for GitHub API calls
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get contributions with fallback for errors
	contributions, err := getGitHubContributions("TylerGilman")
	if err != nil {
		slog.Error("Error fetching GitHub contributions:", slog.String("Error", err.Error()))
		// Use empty contributions but still render the page
		contributions = []models.ContributionDay{}
	}

	// Set up buffers for both versions of the page
	var fullBuf, partialBuf bytes.Buffer

	// Pass false as isAdmin for cached version since we'll check auth at request time
	err = projects.Projects(contributions, false).Render(ctx, &fullBuf)
	if err != nil {
		slog.Error("Error rendering full projects page: %v", slog.String("Error", err.Error()))
		return
	}

	err = projects.Partial(contributions).Render(ctx, &partialBuf)
	if err != nil {
		slog.Error("Error rendering partial projects page: %v", slog.String("Error", err.Error()))
		return
	}

	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	cachedFullPage = fullBuf.Bytes()
	cachedPartialPage = partialBuf.Bytes()

	// Cache for 3 hours to reduce refresh frequency
	expirationTime := time.Now().Add(3 * time.Hour)
	fullPageExpiration = expirationTime
	partialPageExpiration = expirationTime

	slog.Info("Projects cache updated successfully.", slog.String("update time", time.Since(startTime).String()))
}

func HandleProjects(w http.ResponseWriter, r *http.Request) error {
	// Set performance headers
	w.Header().Set("Cache-Control", "public, max-age=600") // 10 minute client cache
	w.Header().Set("X-Content-Type-Options", "nosniff")
	
	isAdmin := authpkg.IsAuthenticated(r)

	// Check if we need to update the cache
	cacheMutex.RLock()
	fullCacheEmpty := len(cachedFullPage) == 0
	partialCacheEmpty := len(cachedPartialPage) == 0
	fullCacheExpired := time.Now().After(fullPageExpiration)
	partialCacheExpired := time.Now().After(partialPageExpiration)
	
	// If cache is valid, serve from cache immediately
	if !fullCacheEmpty && !partialCacheEmpty && !fullCacheExpired && !partialCacheExpired {
		// Fast path - serve from cache
		if !isAdmin {
			// For normal users, serve directly from cache
			cacheMutex.RUnlock()
			
			// Handle HTMX requests for partial content
			if r.Header.Get("HX-Request") == "true" {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.Write(cachedPartialPage)
				return nil
			}
			
			// Full page request
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(cachedFullPage)
			return nil
		}
	}
	cacheMutex.RUnlock()

	// If we got here, we need to update or honor admin status
	if fullCacheEmpty || partialCacheEmpty || fullCacheExpired || partialCacheExpired {
		slog.Info("Projects cache is empty or expired. Updating cache...")
		go UpdateProjectsCache() // Update cache in background
	}
	
	// For normal requests when cache is not available, or for admin users
	contributions, err := getGitHubContributions("TylerGilman")
	if err != nil {
		slog.Error("Error fetching GitHub contributions", "error", err)
		contributions = []models.ContributionDay{}
	}

    renderer := NewPageRenderer(
        projects.Projects(contributions, isAdmin),
        projects.Partial(contributions),
    )

    return renderer.Render(w, r)
}

func fetchGitHubContributions(username string) ([]byte, error) {
	// Calculate the date 3 months ago and format it correctly
	threeMonthsAgo := time.Now().AddDate(0, -3, 0).Format(time.RFC3339)

	query := `
    query($username: String!, $from: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
    `
	variables := map[string]string{
		"username": username,
		"from":     threeMonthsAgo,
	}
	jsonValue, _ := json.Marshal(map[string]interface{}{
		"query":     query,
		"variables": variables,
	})

	req, err := http.NewRequest("POST", "https://api.github.com/graphql", strings.NewReader(string(jsonValue)))
	if err != nil {
		return nil, err
	}
	token := os.Getenv("GITHUB_TOKEN")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	
	// Configure transport to skip TLS verification in production
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Transport: tr}
	
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
  fmt.Printf("Raw GitHub Response: %s\n", string(body))
	if err != nil {
		return nil, err
	}

	return body, nil
}

func getGitHubContributions(username string) ([]models.ContributionDay, error) {
	rawData, err := fetchGitHubContributions(username)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch contributions: %w", err)
	}

	var result map[string]interface{}
	err = json.Unmarshal(rawData, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Check for errors in the response
	if errors, ok := result["errors"].([]interface{}); ok && len(errors) > 0 {
		return nil, fmt.Errorf("GitHub API returned errors: %v", errors)
	}

	data, ok := result["data"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response structure: missing 'data' field")
	}

	user, ok := data["user"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response structure: missing 'user' field")
	}

	contributionsCollection, ok := user["contributionsCollection"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response structure: missing 'contributionsCollection' field")
	}

	contributionCalendar, ok := contributionsCollection["contributionCalendar"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response structure: missing 'contributionCalendar' field")
	}

	weeks, ok := contributionCalendar["weeks"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response structure: missing 'weeks' field")
	}

	var contributions []models.ContributionDay
	for _, week := range weeks {
		weekMap, ok := week.(map[string]interface{})
		if !ok {
			continue
		}
		days, ok := weekMap["contributionDays"].([]interface{})
		if !ok {
			continue
		}
		for _, day := range days {
			dayMap, ok := day.(map[string]interface{})
			if !ok {
				continue
			}
			date, ok := dayMap["date"].(string)
			if !ok {
				continue
			}
			count, ok := dayMap["contributionCount"].(float64)
			if !ok {
				continue
			}
			contributions = append(contributions, models.ContributionDay{
				Date:  date,
				Count: int(count),
			})
		}
	}
	var filteredContributions []models.ContributionDay
	today := time.Now().Format("2006-01-02")
	threeMonthsAgo := time.Now().AddDate(0, -3, 0).Format("2006-01-02")

	for _, contribution := range contributions {
		if contribution.Date <= today && contribution.Date >= threeMonthsAgo {
			filteredContributions = append(filteredContributions, contribution)
		}
	}

	// Sort contributions in reverse chronological order
	sort.Slice(filteredContributions, func(i, j int) bool {
		return filteredContributions[i].Date > filteredContributions[j].Date
	})

	return filteredContributions, nil
}
