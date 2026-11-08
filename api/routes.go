package api

import (
	"bytes"
	"io/fs"
	"net/http"
	"time"
)

func Register(mux *http.ServeMux, handler Handler, static fs.FS) {
	mux.HandleFunc("/api/data", handler.GetData)
	mux.HandleFunc("/api/save", handler.SaveData)
	mux.HandleFunc("/api/xirr", handler.GetXIRR)

	indexHTML, _ := fs.ReadFile(static, "index.html")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			path = "index.html"
		} else {
			path = path[1:]
		}
		if raw, err := fs.ReadFile(static, path); err == nil {
			http.ServeContent(w, r, path, time.Now(), bytes.NewReader(raw))
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(indexHTML)
	})
}
