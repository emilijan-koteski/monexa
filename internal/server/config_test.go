package server

import (
	"reflect"
	"testing"
)

func TestListenPortDefaultsTo8080(t *testing.T) {
	t.Setenv("PORT", "")
	if got := ListenPort(); got != "8080" {
		t.Errorf("ListenPort() = %q, want 8080", got)
	}
}

func TestListenPortReadsPORT(t *testing.T) {
	t.Setenv("PORT", "9000")
	if got := ListenPort(); got != "9000" {
		t.Errorf("ListenPort() = %q, want 9000", got)
	}
}

func TestCORSOriginsParsesAndTrims(t *testing.T) {
	t.Setenv("CORS_ORIGINS", " https://monexa.world, https://www.monexa.world ,")
	got := CORSOrigins()
	want := []string{"https://monexa.world", "https://www.monexa.world"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("CORSOrigins() = %v, want %v", got, want)
	}
}

func TestCORSOriginsUnsetAllowsAnyOrigin(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "")
	got := CORSOrigins()
	want := []string{"https://*", "http://*"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("CORSOrigins() = %v, want %v", got, want)
	}
}

func TestMissingEnvListsUnsetAndEmptyNames(t *testing.T) {
	t.Setenv("MONEXA_TEST_SET", "x")
	t.Setenv("MONEXA_TEST_EMPTY", "")
	got := missingEnv("MONEXA_TEST_SET", "MONEXA_TEST_EMPTY", "MONEXA_TEST_UNSET")
	want := []string{"MONEXA_TEST_EMPTY", "MONEXA_TEST_UNSET"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("missingEnv() = %v, want %v", got, want)
	}
}

func TestRequiredEnvNamesEveryVariableTheProcessDiesWithout(t *testing.T) {
	want := []string{"DATABASE_URL", "JWT_SECRET", "PPID_SECRET", "RESEND_API_KEY", "RESEND_FROM_NAME", "RESEND_FROM_ADDRESS", "FRONTEND_URL"}
	if !reflect.DeepEqual(RequiredEnv, want) {
		t.Errorf("RequiredEnv = %v, want %v", RequiredEnv, want)
	}
}
