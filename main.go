package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"financial-dashboard/api"
	"financial-dashboard/store"
)

//go:embed frontend/dist/*
var embeddedFrontend embed.FS

func main() {
	port := envOr("FINDASH_PORT", "8080")
	dataPath := envOr("FINDASH_DATA", filepath.Join(".", "data.json"))

	if err := store.EnsureFile(dataPath); err != nil {
		log.Fatalf("unable to initialize data file: %v", err)
	}

	staticFS, err := fs.Sub(embeddedFrontend, "frontend/dist")
	if err != nil {
		log.Fatalf("unable to load embedded frontend: %v", err)
	}

	mux := http.NewServeMux()
	api.Register(mux, api.NewHandler(dataPath), staticFS)

	addr := ":" + port
	log.Printf("findash running at http://localhost%s", addr)
	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
