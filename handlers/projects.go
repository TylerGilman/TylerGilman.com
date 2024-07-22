package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/TylerGilman/nereus_main_site/views/models"
	"github.com/TylerGilman/nereus_main_site/views/projects"
)

var (
	cachedFullPage        []byte
	cachedPartialPage     []byte
	cacheMutex            sync.RWMutex
	fullPageExpiration    time.Time
	partialPageExpiration time.Time
)

func UpdateProjectsCache() {
	log.Println("Updating projects cache...")
	startTime := time.Now()

	contributions, err := getGitHubContributions("TylerGilman")
	if err != nil {
		log.Printf("Error fetching GitHub contributions: %v", err)
		return
	}

	var fullBuf, partialBuf bytes.Buffer
	ctx := context.Background()

	err = projects.Projects(contributions).Render(ctx, &fullBuf)
	if err != nil {
		log.Printf("Error rendering full projects page: %v", err)
		return
	}

	err = projects.Partial(contributions).Render(ctx, &partialBuf)
	if err != nil {
		log.Printf("Error rendering partial projects page: %v", err)
		return
	}

	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	cachedFullPage = fullBuf.Bytes()
	cachedPartialPage = partialBuf.Bytes()

	expirationTime := time.Now().Add(1 * time.Hour)
	fullPageExpiration = expirationTime
	partialPageExpiration = expirationTime

	log.Printf("Projects cache updated successfully. Took %v", time.Since(startTime))
}

func HandleProjects(w http.ResponseWriter, r *http.Request) error {
	isHtmxRequest := r.Header.Get("HX-Request") == "true"

	cacheMutex.RLock()
	fullCacheEmpty := len(cachedFullPage) == 0
	partialCacheEmpty := len(cachedPartialPage) == 0
	fullCacheExpired := time.Now().After(fullPageExpiration)
	partialCacheExpired := time.Now().After(partialPageExpiration)
	cacheMutex.RUnlock()

	if fullCacheEmpty || partialCacheEmpty || fullCacheExpired || partialCacheExpired {
		log.Println("Projects cache is empty or expired. Updating cache...")
		UpdateProjectsCache()
	}

	if isHtmxRequest {
		cacheMutex.RLock()
		defer cacheMutex.RUnlock()

		if len(cachedPartialPage) > 0 && !partialCacheExpired {
			log.Println("Serving partial projects page from cache")
			w.Header().Set("X-Served-From-Cache", "true")
			_, err := w.Write(cachedPartialPage)
			return err
		} else {
			log.Println("Partial cache is empty or expired. Rendering partial projects page on the fly")
			contributions, err := getGitHubContributions("TylerGilman")
			if err != nil {
				log.Printf("Error fetching GitHub contributions: %v", err)
				contributions = []models.ContributionDay{}
			}
			return projects.Partial(contributions).Render(r.Context(), w)
		}
	} else {
		cacheMutex.RLock()
		defer cacheMutex.RUnlock()

		if len(cachedFullPage) > 0 && !fullCacheExpired {
			log.Println("Serving full projects page from cache")
			w.Header().Set("X-Served-From-Cache", "true")
			_, err := w.Write(cachedFullPage)
			return err
		} else {
			log.Println("Full cache is empty or expired. Rendering full projects page on the fly")
			contributions, err := getGitHubContributions("TylerGilman")
			if err != nil {
				log.Printf("Error fetching GitHub contributions: %v", err)
				contributions = []models.ContributionDay{}
			}
			return projects.Projects(contributions).Render(r.Context(), w)
		}
	}
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
	req.Header.Set("Authorization", "Bearer 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")
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
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
