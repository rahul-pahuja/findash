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
	if len(filtered) != 2 {
		t.Fatalf("expected the cutoff snapshot and the latest snapshot in the exact 1M window, got %d", len(filtered))
	}
	if filtered[0].ID != "2025-02-28" || filtered[1].ID != "2025-03-31" {
		t.Fatalf("expected cutoff day and latest snapshot; got %v", []string{filtered[0].ID, filtered[1].ID})
	}
}
