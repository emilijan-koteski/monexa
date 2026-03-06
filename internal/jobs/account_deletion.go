package jobs

import (
	"context"
	"log"
	"time"

	"github.com/emilijan-koteski/monexa/internal/services"
)

type AccountDeletionJob struct {
	userService *services.UserService
	interval    time.Duration
	stopCh      chan struct{}
}

func NewAccountDeletionJob(userService *services.UserService, interval time.Duration) *AccountDeletionJob {
	return &AccountDeletionJob{
		userService: userService,
		interval:    interval,
		stopCh:      make(chan struct{}),
	}
}

func (j *AccountDeletionJob) Start() {
	go j.run()
}

func (j *AccountDeletionJob) Stop() {
	close(j.stopCh)
}

func (j *AccountDeletionJob) run() {
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

func (j *AccountDeletionJob) cleanup() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Phase 1: Send reminder emails (1 day before final deletion)
	reminderUsers, err := j.userService.GetUsersForDeletionReminder(ctx)
	if err != nil {
		log.Printf("Error fetching users for deletion reminder: %v", err)
	} else {
		for _, user := range reminderUsers {
			j.userService.SendDeletionReminderEmail(ctx, user)
		}
		if len(reminderUsers) > 0 {
			log.Printf("Sent %d account deletion reminder email(s)", len(reminderUsers))
		}
	}

	// Phase 2: Finalize deletions (grace period expired)
	deletionUsers, err := j.userService.GetUsersForFinalDeletion(ctx)
	if err != nil {
		log.Printf("Error fetching users for final deletion: %v", err)
		return
	}

	deletedCount := 0
	for _, user := range deletionUsers {
		if err := j.userService.FinalizeUserDeletion(ctx, user.ID); err != nil {
			log.Printf("Error finalizing deletion for user %d: %v", user.ID, err)
			continue
		}
		deletedCount++
	}
	if deletedCount > 0 {
		log.Printf("Finalized %d account deletion(s)", deletedCount)
	}
}
