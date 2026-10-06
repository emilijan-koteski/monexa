package jobs

import (
	"context"
	"log"
	"time"

	"github.com/emilijan-koteski/monexa/internal/services"
)

type RecurringExpenseGenerationJob struct {
	recurringExpenseService *services.RecurringExpenseService
	interval                time.Duration
	stopCh                  chan struct{}
}

func NewRecurringExpenseGenerationJob(recurringExpenseService *services.RecurringExpenseService, interval time.Duration) *RecurringExpenseGenerationJob {
	return &RecurringExpenseGenerationJob{
		recurringExpenseService: recurringExpenseService,
		interval:                interval,
		stopCh:                  make(chan struct{}),
	}
}

func (j *RecurringExpenseGenerationJob) Start() {
	go j.run()
}

func (j *RecurringExpenseGenerationJob) Stop() {
	close(j.stopCh)
}

func (j *RecurringExpenseGenerationJob) run() {
	j.generate()

	ticker := time.NewTicker(j.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			j.generate()
		case <-j.stopCh:
			return
		}
	}
}

func (j *RecurringExpenseGenerationJob) generate() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	dueExpenses, err := j.recurringExpenseService.GetDueRecurringExpenses(ctx)
	if err != nil {
		log.Printf("🛑 Error!!! Error fetching due recurring expenses: %v", err)
		return
	}

	generatedCount := 0
	for _, recurringExpense := range dueExpenses {
		count, err := j.recurringExpenseService.GenerateDueRecords(ctx, recurringExpense.ID)
		if err != nil {
			log.Printf("🛑 Error!!! Error generating records for recurring expense %d: %v", recurringExpense.ID, err)
			continue
		}
		generatedCount += count
	}

	if generatedCount > 0 {
		log.Printf("Generated %d record(s) from recurring expenses", generatedCount)
	}
}
