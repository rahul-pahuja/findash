package calc

import (
	"fmt"
	"time"

	"financial-dashboard/store"
)

var RangeMonths = map[string]int{
	"1M":  1,
	"3M":  3,
	"6M":  6,
	"1Y":  12,
	"3Y":  36,
	"5Y":  60,
	"ALL": 0,
}

type DerivedMetric struct {
	HardCapital         float64            `json:"hardCapital"`
	CurrentNetWorth     float64            `json:"currentNetWorth"`
	UnrealizedGain      float64            `json:"unrealizedGain"`
	LiquidBuffer        float64            `json:"liquidBuffer"`
	MarketExposure      float64            `json:"marketExposure"`
	NetWorthAddition    *float64           `json:"netWorthAddition"`
	AllocationByAsset   map[string]float64 `json:"allocationByAsset"`
	MonthLabel          string             `json:"monthLabel"`
	VisibleRangeKey     string             `json:"visibleRangeKey,omitempty"`
	LatestVisibleRecord bool               `json:"latestVisibleRecord,omitempty"`
}

type SummaryMetric struct {
	RangeKey           string             `json:"rangeKey"`
	EntryCount         int                `json:"entryCount"`
	LatestMonth        string             `json:"latestMonth"`
	LatestNetWorth     float64            `json:"latestNetWorth"`
	LatestHardCapital  float64            `json:"latestHardCapital"`
	LatestLiquidBuffer float64            `json:"latestLiquidBuffer"`
	AllocationByAsset  map[string]float64 `json:"allocationByAsset"`
	TotalUnrealized    float64            `json:"totalUnrealized"`
}

type DataResponse struct {
	Dataset         store.Dataset            `json:"dataset"`
	Derived         map[string]DerivedMetric `json:"derived"`
	VisibleEntryIDs []string                 `json:"visibleEntryIds"`
	Summary         SummaryMetric            `json:"summary"`
	Range           RangeMeta                `json:"range"`
	Sync            store.SyncMetadata       `json:"sync"`
}

type RangeMeta struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

func NormalizeRangeKey(key string) string {
	if key == "" {
		return "ALL"
	}
	if _, ok := RangeMonths[stringsUpper(key)]; ok {
		return stringsUpper(key)
	}
	return "ALL"
}

func stringsUpper(v string) string {
	out := make([]rune, 0, len(v))
	for _, r := range v {
		if r >= 'a' && r <= 'z' {
			r -= 32
		}
		out = append(out, r)
	}
	return string(out)
}

func ComputeDerived(data store.Dataset) map[string]DerivedMetric {
	derived := map[string]DerivedMetric{}
	var previous *DerivedMetric

	for _, entry := range data.Entries {
		hardCapital := entry.Liquid.Bank + entry.Liquid.Sodexo + entry.HardAssets.StocksWallet + entry.HardAssets.FD
		currentNetWorth := hardCapital
		marketExposure := 0.0
		allocation := map[string]float64{}
		for _, asset := range store.CanonicalAssetOrder() {
			value := entry.MarketAssets[asset]
			hardCapital += value.Invested
			currentNetWorth += value.Current
			marketExposure += value.Current
		}
		for _, asset := range store.CanonicalAssetOrder() {
			value := entry.MarketAssets[asset]
			if currentNetWorth > 0 {
				allocation[asset] = value.Current / currentNetWorth
			}
		}
		if currentNetWorth > 0 {
			allocation["liquid"] = (entry.Liquid.Bank + entry.Liquid.Sodexo) / currentNetWorth
			allocation["fd"] = entry.HardAssets.FD / currentNetWorth
			allocation["stocksWallet"] = entry.HardAssets.StocksWallet / currentNetWorth
		}

		metric := DerivedMetric{
			HardCapital:       hardCapital,
			CurrentNetWorth:   currentNetWorth,
			UnrealizedGain:    currentNetWorth - hardCapital,
			LiquidBuffer:      entry.Liquid.Bank + entry.Liquid.Sodexo,
			MarketExposure:    marketExposure,
			AllocationByAsset: allocation,
			MonthLabel:        entry.ID,
		}

		if previous != nil {
			delta := metric.CurrentNetWorth - previous.CurrentNetWorth
			metric.NetWorthAddition = &delta
		}
		derived[entry.ID] = metric
		previous = &metric
	}
	return derived
}

func FilterEntries(entries []store.Entry, key string) []store.Entry {
	key = NormalizeRangeKey(key)
	months := RangeMonths[key]
	if months == 0 || len(entries) == 0 {
		out := make([]store.Entry, len(entries))
		copy(out, entries)
		return out
	}
	latest, err := time.Parse("2006-01-02", entries[len(entries)-1].Date)
	if err != nil {
		return append([]store.Entry(nil), entries...)
	}
	monthStart := time.Date(latest.Year(), latest.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -months, 0)
	lastDay := time.Date(monthStart.Year(), monthStart.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
	day := latest.Day()
	if day > lastDay {
		day = lastDay
	}
	cutoff := time.Date(monthStart.Year(), monthStart.Month(), day, 0, 0, 0, 0, time.UTC)
	anchorIndex := -1
	firstAfter := -1
	for i, entry := range entries {
		date, parseErr := time.Parse("2006-01-02", entry.Date)
		if parseErr != nil {
			continue
		}
		if date.After(cutoff) {
			firstAfter = i
			break
		}
		anchorIndex = i
	}
	start := anchorIndex
	if start < 0 {
		start = firstAfter
	}
	if start < 0 {
		start = len(entries) - 1
	}
	return append([]store.Entry(nil), entries[start:]...)
}

func BuildDataResponse(data store.Dataset, rangeKey string, sync store.SyncMetadata) DataResponse {
	rangeKey = NormalizeRangeKey(rangeKey)
	// Compute derived for ALL entries to ensure continuity (e.g. net worth delta)
	allDerived := ComputeDerived(data)

	filtered := FilterEntries(data.Entries, rangeKey)
	visibleIDs := make([]string, 0, len(filtered))
	for _, entry := range filtered {
		visibleIDs = append(visibleIDs, entry.ID)
	}

	summary := SummaryMetric{RangeKey: rangeKey, EntryCount: len(filtered), AllocationByAsset: map[string]float64{}}
	if len(filtered) > 0 {
		latest := filtered[len(filtered)-1]
		lastDerived := allDerived[latest.ID]
		summary.LatestMonth = latest.ID
		summary.LatestNetWorth = lastDerived.CurrentNetWorth
		summary.LatestHardCapital = lastDerived.HardCapital
		summary.LatestLiquidBuffer = lastDerived.LiquidBuffer
		summary.AllocationByAsset = lastDerived.AllocationByAsset
		summary.TotalUnrealized = lastDerived.UnrealizedGain
	}

	return DataResponse{
		Dataset:         data,
		Derived:         allDerived,
		VisibleEntryIDs: visibleIDs,
		Summary:         summary,
		Range:           RangeMeta{Key: rangeKey, Label: rangeLabel(rangeKey)},
		Sync:            sync,
	}
}

func rangeLabel(key string) string {
	switch NormalizeRangeKey(key) {
	case "1M":
		return "Last 1 Month"
	case "3M":
		return "Last 3 Months"
	case "6M":
		return "Last 6 Months"
	case "1Y":
		return "Last 1 Year"
	case "3Y":
		return "Last 3 Years"
	case "5Y":
		return "Last 5 Years"
	default:
		return "All Time"
	}
}

func ParseDate(value string) time.Time {
	t, _ := time.Parse("2006-01-02", value)
	return t
}

func RangeWindow(entries []store.Entry, key string) (time.Time, time.Time, error) {
	if len(entries) == 0 {
		return time.Time{}, time.Time{}, fmt.Errorf("no entries available")
	}
	filtered := FilterEntries(entries, key)
	start := ParseDate(filtered[0].Date)
	end := ParseDate(filtered[len(filtered)-1].Date)
	return start, end, nil
}
