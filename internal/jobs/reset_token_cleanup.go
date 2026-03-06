package jobs

import (
	"context"
	"log"
	"time"

	"github.com/emilijan-koteski/monexa/internal/services"
)

type ResetTokenCleanupJob struct {
	userService *services.UserService
	interval    time.Duration
	stopCh      chan struct{}
}

func NewResetTokenCleanupJob(userService *services.UserService, interval time.Duration) *ResetTokenCleanupJob {
	return &ResetTokenCleanupJob{
		userService: userService,
		interval:    interval,
		stopCh:      make(chan struct{}),
	}
}

func (j *ResetTokenCleanupJob) Start() {
	go j.run()
}

func (j *ResetTokenCleanupJob) Stop() {
	close(j.stopCh)
}

func (j *ResetTokenCleanupJob) run() {
	j.cleanup()

	ticker := time.NewTicker(j.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			j.cleanup()
		case <-j.stopCh:
			return
		}
	}
}

func (j *ResetTokenCleanupJob) cleanup() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err := j.userService.CleanupExpiredResetTokens(ctx)
	if err != nil {
		log.Printf("🛑 Error cleaning up expired reset tokens: %v", err)
		return
	}
}
