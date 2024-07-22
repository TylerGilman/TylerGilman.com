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
	for i := 0; i < totalDays; i++ {
		date := today.AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		weekIndex := (totalDays - 1 - i) / 7
		dayIndex := int(date.Weekday())

		contribution := models.ContributionDay{Date: dateStr, Count: 0}
		for _, c := range contributions {
			if c.Date == dateStr {
				contribution = c
				break
			}
		}

		columns[weekIndex][dayIndex] = contribution
	}

	return columns
}
