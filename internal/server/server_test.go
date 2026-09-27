package server

import (
	"syscall"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

func TestStartServerReturnsAfterSIGTERM(t *testing.T) {
	t.Setenv("PORT", "0") // random free port
	e := echo.New()
	e.HideBanner, e.HidePort = true, true

	done := make(chan struct{})
	go func() {
		StartServer(e)
		close(done)
	}()

	deadline := time.Now().Add(5 * time.Second)
	for e.ListenerAddr() == nil {
		if time.Now().After(deadline) {
			t.Fatal("server never started listening")
		}
		time.Sleep(10 * time.Millisecond)
	}

	if err := syscall.Kill(syscall.Getpid(), syscall.SIGTERM); err != nil {
		t.Fatal(err)
	}

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("StartServer did not return within 5s of SIGTERM")
	}
}
