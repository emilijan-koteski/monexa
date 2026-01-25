package jobs

import (
	"context"
	"log"
	"time"

	"github.com/emilijan-koteski/monexa/internal/services"
)

type ExchangeRateUpdateJob struct {
	currencyService *services.CurrencyService
	interval        time.Duration
	stopCh          chan struct{}
}

// NewExchangeRateUpdateJob creates a new exchange rate update job
func NewExchangeRateUpdateJob(currencyService *services.CurrencyService, interval time.Duration) *ExchangeRateUpdateJob {
	return &ExchangeRateUpdateJob{
		currencyService: currencyService,
		interval:        interval,
		stopCh:          make(chan struct{}),
	}
}

func (j *ExchangeRateUpdateJob) Start() {
	go j.run()
}

func (j *ExchangeRateUpdateJob) Stop() {
	close(j.stopCh)
}

func (j *ExchangeRateUpdateJob) run() {
	j.update()

	ticker := time.NewTicker(j.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			j.update()
		case <-j.stopCh:
			return
		}
	}
}

func (j *ExchangeRateUpdateJob) update() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := j.currencyService.FetchAndStoreLatestRates(ctx)
	if err != nil {
		log.Printf("🛑 Error!!! Error updating exchange rates: %v", err)
		return
	}
}
