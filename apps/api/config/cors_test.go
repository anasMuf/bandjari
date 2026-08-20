package config

import (
	"reflect"
	"testing"
)

func TestLoadCORSAllowedOrigins_defaultAllowsAll(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	if got := LoadCORSAllowedOrigins(); !reflect.DeepEqual(got, []string{"*"}) {
		t.Fatalf("expected [*], got %v", got)
	}
}

func TestLoadCORSAllowedOrigins_explicitList(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", " https://bandjari.net, https://www.bandjari.net , ")
	got := LoadCORSAllowedOrigins()
	want := []string{"https://bandjari.net", "https://www.bandjari.net"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
}
