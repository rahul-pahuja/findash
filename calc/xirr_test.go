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
	// The sample dataset is monthly, so the 1M window anchored on the latest
	// snapshot must hold exactly the latest entry and the one before it.
	if filtered[1].ID != data.Entries[len(data.Entries)-1].ID {
		t.Fatalf("expected the latest snapshot in the window; got %s", filtered[1].ID)
	}
	if filtered[0].ID != data.Entries[len(data.Entries)-2].ID {
		t.Fatalf("expected the snapshot immediately before the latest as the window cutoff; got %s", filtered[0].ID)
	}
}
