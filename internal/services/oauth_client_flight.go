package services

import (
	"context"
	"fmt"
	"log"
	"runtime/debug"
	"sync"

	"github.com/emilijan-koteski/monexa/internal/models"
)

type clientFlight struct {
	done    chan struct{}
	cancel  context.CancelFunc
	waiters int
	client  *models.OAuthClient
	err     error
}

type clientFlightGroup struct {
	mu      sync.Mutex
	flights map[string]*clientFlight
}

// do runs load once per key for all concurrent callers. The shared work is cancelled only when every caller has given up, so one caller's cancellation never fails the others.
func (g *clientFlightGroup) do(ctx context.Context, key string, load func(context.Context) (*models.OAuthClient, error)) (*models.OAuthClient, error) {
	flight := g.join(ctx, key, load)
	select {
	case <-flight.done:
		return flight.client, flight.err
	case <-ctx.Done():
		g.leave(key, flight)
		return nil, ctx.Err()
	}
}

func (g *clientFlightGroup) join(ctx context.Context, key string, load func(context.Context) (*models.OAuthClient, error)) *clientFlight {
	g.mu.Lock()
	defer g.mu.Unlock()

	if flight, running := g.flights[key]; running {
		flight.waiters++
		return flight
	}
	if g.flights == nil {
		g.flights = map[string]*clientFlight{}
	}
	loadCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))
	flight := &clientFlight{done: make(chan struct{}), cancel: cancel, waiters: 1}
	g.flights[key] = flight
	go g.run(key, flight, loadCtx, load)
	return flight
}

func (g *clientFlightGroup) run(key string, flight *clientFlight, ctx context.Context, load func(context.Context) (*models.OAuthClient, error)) {
	flight.client, flight.err = loadRecovered(ctx, key, load)
	g.forget(key, flight)
	flight.cancel()
	close(flight.done)
}

// loadRecovered turns a panic in load into an error, because it runs on a detached goroutine where a panic would crash the API.
func loadRecovered(ctx context.Context, key string, load func(context.Context) (*models.OAuthClient, error)) (client *models.OAuthClient, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Printf("oauth: loading client %q panicked: %v\n%s", key, recovered, debug.Stack())
			client, err = nil, fmt.Errorf("loading client %q panicked: %v", key, recovered)
		}
	}()
	return load(ctx)
}

func (g *clientFlightGroup) leave(key string, flight *clientFlight) {
	g.mu.Lock()
	defer g.mu.Unlock()

	flight.waiters--
	if flight.waiters > 0 {
		return
	}
	if g.flights[key] == flight {
		delete(g.flights, key)
	}
	flight.cancel()
}

func (g *clientFlightGroup) forget(key string, flight *clientFlight) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.flights[key] == flight {
		delete(g.flights, key)
	}
}
