package calc

import (
	"testing"

	"financial-dashboard/store"
)

func TestComputeXirrProducesPerAssetData(t *testing.T) {
	data := store.NewSampleDataset()
	result := ComputeXirr(data, "ALL", nil, nil)

	if result.MarketPortfolio.Status == "" {
		t.Fatal("expected market portfolio status")
	}
	if len(result.PerAsset.PerAsset) != len(store.CanonicalAssetOrder()) {
		t.Fatalf("expected %d per-asset results, got %d", len(store.CanonicalAssetOrder()), len(result.PerAsset.PerAsset))
	}
}

func TestComputeDerivedRangeFiltering(t *testing.T) {
	data := store.NewSampleDataset()
	filtered := FilterEntries(data.Entries, "1M")
	if len(filtered) != 1 {
		t.Fatalf("expected 1 entry for 1M, got %d", len(filtered))
	}
	if filtered[0].ID != "2025-03-31" {
		t.Fatalf("expected latest entry, got %s", filtered[0].ID)
	}
}
