package jobs

import (
	"context"
	"log"
	"time"

	"github.com/emilijan-koteski/monexa/internal/services"
)

const (
	oauthCleanupTimeout = 30 * time.Second
	staleOAuthClientAge = 7 * 24 * time.Hour
)

type OAuthCleanupJob struct {
	tokenService         *services.OAuthTokenService
	authorizationService *services.OAuthAuthorizationService
	clientService        *services.OAuthClientService
	interval             time.Duration
	stopCh               chan struct{}
}

func NewOAuthCleanupJob(tokenService *services.OAuthTokenService, authorizationService *services.OAuthAuthorizationService,
	clientService *services.OAuthClientService, interval time.Duration) *OAuthCleanupJob {
	return &OAuthCleanupJob{
		tokenService:         tokenService,
		authorizationService: authorizationService,
		clientService:        clientService,
		interval:             interval,
		stopCh:               make(chan struct{}),
	}
}

func (j *OAuthCleanupJob) Start() {
	go j.run()
}

func (j *OAuthCleanupJob) Stop() {
	close(j.stopCh)
}

func (j *OAuthCleanupJob) run() {
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

func (j *OAuthCleanupJob) cleanup() {
	ctx, cancel := context.WithTimeout(context.Background(), oauthCleanupTimeout)
	defer cancel()

	tokens, err := j.tokenService.DeleteExpired(ctx)
	if err != nil {
		log.Printf("🛑 Error!!! Error deleting expired OAuth tokens: %v", err)
	}
	authorizations, err := j.authorizationService.DeleteExpired(ctx)
	if err != nil {
		log.Printf("🛑 Error!!! Error deleting expired OAuth authorizations: %v", err)
	}
	clients, err := j.clientService.DeleteStaleClients(ctx, staleOAuthClientAge)
	if err != nil {
		log.Printf("🛑 Error!!! Error deleting stale OAuth clients: %v", err)
	}

	if tokens+authorizations+clients > 0 {
		log.Printf("OAuth cleanup removed %d token(s), %d authorization(s) and %d client(s)", tokens, authorizations, clients)
	}
}
