package store

import (
	"os"
	"path/filepath"
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

func TestValidateDatasetRejectsNegativeSIP(t *testing.T) {
	data := NewSampleDataset()
	v := -10.0
	data.Entries[0].SIP["crypto"] = &v
	if err := ValidateDataset(&data); err == nil {
		t.Fatal("expected validation error")
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
