package jobs

import (
	"context"
	"log"
	"time"

	"github.com/emilijan-koteski/monexa/internal/services"
)

type SessionCleanupJob struct {
	sessionService *services.SessionService
	interval       time.Duration
	stopCh         chan struct{}
}

// NewSessionCleanupJob creates a new session cleanup job
func NewSessionCleanupJob(sessionService *services.SessionService, interval time.Duration) *SessionCleanupJob {
	return &SessionCleanupJob{
		sessionService: sessionService,
		interval:       interval,
		stopCh:         make(chan struct{}),
	}
}

func (j *SessionCleanupJob) Start() {
	go j.run()
}

func (j *SessionCleanupJob) Stop() {
	close(j.stopCh)
}

func (j *SessionCleanupJob) run() {
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

func (j *SessionCleanupJob) cleanup() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err := j.sessionService.CleanupExpiredSessions(ctx)
	if err != nil {
		log.Printf("🛑 Error!!! Error cleaning up expired sessions: %v", err)
		return
	}
}
