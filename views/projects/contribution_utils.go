package projects

import (
	"time"

	"github.com/TylerGilman/nereus_main_site/views/models"
)

func organizeContributions(contributions []models.ContributionDay) [][]models.ContributionDay {
	totalDays := 91
	columns := make([][]models.ContributionDay, (totalDays+6)/7)
	for i := range columns {
		columns[i] = make([]models.ContributionDay, 7)
	}

	today := time.Now()
	contributionMap := make(map[string]int)
	for _, c := range contributions {
		contributionMap[c.Date] = c.Count
	}

	for i := 0; i < totalDays; i++ {
		date := today.AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		weekIndex := (totalDays - 1 - i) / 7
		dayIndex := 6 - int(date.Weekday())

		if weekIndex < 0 || weekIndex >= len(columns) || dayIndex < 0 || dayIndex >= 7 {
			continue // Skip invalid indices
		}

		count, exists := contributionMap[dateStr]
		if !exists {
			count = 0
		}

		columns[weekIndex][dayIndex] = models.ContributionDay{
			Date:  dateStr,
			Count: count,
		}
	}

	return columns
}
