package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSaveAndLoadDataset(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "data.json")
	data := NewSampleDataset()

	if err := SaveDataset(path, data); err != nil {
		t.Fatalf("save dataset: %v", err)
	}

	loaded, err := LoadDataset(path)
	if err != nil {
		t.Fatalf("load dataset: %v", err)
	}

	if len(loaded.Entries) != len(data.Entries) {
		t.Fatalf("expected %d entries, got %d", len(data.Entries), len(loaded.Entries))
	}
	if loaded.Meta.Currency != "INR" {
		t.Fatalf("expected INR currency, got %s", loaded.Meta.Currency)
	}
}

func TestEnsureFileSeedsDataset(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "data.json")

	if err := EnsureFile(path); err != nil {
		t.Fatalf("ensure file: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected file to exist: %v", err)
	}
}

func TestMigrateLegacyDatasetDropsSnapshotIncomeAndSIP(t *testing.T) {
	legacy := `{"entries":[{"id":"2025-01-31","date":"2025-01-31","income":{"in_hand":85000},"sip":{"mutual_funds":10000},"liquid":{"bank":1},"hard_assets":{},"market_assets":{},"expenses_note":""}],"meta":{"currency":"INR"},"preferences":{"version":1,"shortTermGoal":{"targetAmount":500000,"targetDate":"2025-12-31"},"notifications":{"dismissedGapMonth":"2025-02"}}}`
	var data Dataset
	if err := json.Unmarshal([]byte(legacy), &data); err != nil {
		t.Fatalf("unmarshal legacy dataset: %v", err)
	}
	if err := ValidateDataset(&data); err != nil {
		t.Fatalf("migrate legacy dataset: %v", err)
	}
	if data.SchemaVersion != 2 || len(data.IncomeHistory) != 0 || len(data.ExpenseHistory) != 0 || len(data.Goals) != 1 {
		t.Fatalf("unexpected migrated schema: version=%d incomes=%d expenses=%d goals=%d", data.SchemaVersion, len(data.IncomeHistory), len(data.ExpenseHistory), len(data.Goals))
	}
	encoded, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("marshal migrated data: %v", err)
	}
	if strings.Contains(string(encoded), `"in_hand"`) || strings.Contains(string(encoded), `"sip"`) || strings.Contains(string(encoded), `"shortTermGoal"`) {
		t.Fatalf("legacy snapshot or preference fields remained in migrated JSON: %s", encoded)
	}
	if !strings.Contains(string(encoded), `"dismissedGapMonth":"2025-02"`) {
		t.Fatalf("notification state was not preserved: %s", encoded)
	}
}

func TestValidateDatasetAllowsSameMonthDifferentDays(t *testing.T) {
	data := NewSampleDataset()
	a := data.Entries[0]
	b := data.Entries[0]
	a.ID = "2025-03-10"
	a.Date = "2025-03-10"
	b.ID = "2025-03-20"
	b.Date = "2025-03-20"
	data.Entries = []Entry{a, b}

	if err := ValidateDataset(&data); err != nil {
		t.Fatalf("expected valid dataset, got: %v", err)
	}
}

func TestValidateDatasetRejectsIDDateMismatch(t *testing.T) {
	data := NewSampleDataset()
	data.Entries[0].ID = "2025-01-30"
	data.Entries[0].Date = "2025-01-31"

	if err := ValidateDataset(&data); err == nil {
		t.Fatal("expected id/date mismatch validation error")
	}
}

func TestValidateDatasetRejectsInvalidDate(t *testing.T) {
	data := NewSampleDataset()
	data.Entries[0].Date = "2025-13-99"
	data.Entries[0].ID = "2025-13-99"

	if err := ValidateDataset(&data); err == nil {
		t.Fatal("expected invalid date validation error")
	}
}
