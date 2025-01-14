package projects

import (
	"log/slog"
	"time"

	"github.com/TylerGilman/TylerGilman.com/views/models"
)

func organizeContributions(contributions []models.ContributionDay) [][]models.ContributionDay {
	today := time.Now()
	endDate := today
	startDate := endDate.AddDate(0, -3, 0)                         // Go back 3 months
	startDate = startDate.AddDate(0, 0, -int(startDate.Weekday())) // Adjust to start on a Sunday

	totalDays := int(endDate.Sub(startDate).Hours()/24) + 1 // +1 to include today
	columns := make([][]models.ContributionDay, (totalDays+6)/7)
	for i := range columns {
		columns[i] = make([]models.ContributionDay, 7)
	}

	contributionMap := make(map[string]int)
	for _, c := range contributions {
		contributionMap[c.Date] = c.Count
	}

	for i := 0; i < totalDays; i++ {
		date := startDate.AddDate(0, 0, i)
		dateStr := date.Format("2006-01-02")
		weekIndex := i / 7
		dayIndex := int(date.Weekday())

		if weekIndex >= len(columns) {
			break // We've filled all the columns
		}

		count, exists := contributionMap[dateStr]
		if !exists {
			count = 0
		}

		columns[weekIndex][dayIndex] = models.ContributionDay{
			Date:  dateStr,
			Count: count,
		}

		//		log.Printf("Day %d: Date=%s, WeekIndex=%d, DayIndex=%d, Count=%d",
		//			i, dateStr, weekIndex, dayIndex, count)
	}

	slog.Info("Organized into columns", slog.Int("num cols", len(columns)))
	return columns
}
