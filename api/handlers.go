package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"financial-dashboard/calc"
	"financial-dashboard/store"
)

type Handler struct {
	DataPath string
}

func NewHandler(dataPath string) Handler {
	return Handler{DataPath: dataPath}
}

func (h Handler) GetData(w http.ResponseWriter, r *http.Request) {
	dataset, err := store.LoadDataset(h.DataPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	rangeKey := r.URL.Query().Get("range")
	response := calc.BuildDataResponse(dataset, rangeKey, store.SyncInfo(h.DataPath))
	writeJSON(w, http.StatusOK, response)
}

func (h Handler) SaveData(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var dataset store.Dataset
	if err := json.NewDecoder(r.Body).Decode(&dataset); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}
	if err := store.SaveDataset(h.DataPath, dataset); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	updated, err := store.LoadDataset(h.DataPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response := calc.BuildDataResponse(updated, "ALL", store.SyncInfo(h.DataPath))
	writeJSON(w, http.StatusOK, response)
}

func (h Handler) GetXIRR(w http.ResponseWriter, r *http.Request) {
	dataset, err := h.xirrDataset(r)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, store.ErrInvalidDataset) {
			status = http.StatusBadRequest
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	rangeKey := r.URL.Query().Get("range")
	startDate, endDate := parseOptionalDate(r.URL.Query().Get("start")), parseOptionalDate(r.URL.Query().Get("end"))
	response := calc.ComputeXirr(dataset, rangeKey, startDate, endDate)
	writeJSON(w, http.StatusOK, response)
}

func (h Handler) xirrDataset(r *http.Request) (store.Dataset, error) {
	if r.Method == http.MethodPost {
		defer r.Body.Close()
		var dataset store.Dataset
		if err := json.NewDecoder(r.Body).Decode(&dataset); err != nil {
			return store.Dataset{}, err
		}
		if err := store.ValidateDataset(&dataset); err != nil {
			return store.Dataset{}, err
		}
		return dataset, nil
	}
	return store.LoadDataset(h.DataPath)
}

func parseOptionalDate(value string) *time.Time {
	if value == "" {
		return nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil
	}
	return &parsed
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
