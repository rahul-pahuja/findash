package calc

import (
	"math"
	"sort"
	"time"

	"financial-dashboard/store"
)

type CashFlow struct {
	Date   time.Time `json:"date"`
	Amount float64   `json:"amount"`
}

type XirrResult struct {
	Value     *float64             `json:"value"`
	Status    string               `json:"status"`
	Message   string               `json:"message"`
	CashFlows []CashFlow           `json:"cashFlows"`
	PerAsset  map[string]XirrAsset `json:"perAsset,omitempty"`
	RangeKey  string               `json:"rangeKey"`
	StartDate string               `json:"startDate"`
	EndDate   string               `json:"endDate"`
}

type XirrAsset struct {
	Value    *float64 `json:"value"`
	Status   string   `json:"status"`
	Message  string   `json:"message"`
	Invested float64  `json:"invested"`
	Current  float64  `json:"current"`
}

type XirrResponse struct {
	LifePortfolio   XirrResult `json:"lifePortfolio"`
	MarketPortfolio XirrResult `json:"marketPortfolio"`
	PerAsset        XirrResult `json:"perAsset"`
}

func ComputeXirr(dataset store.Dataset, rangeKey string, startDate, endDate *time.Time) XirrResponse {
	entries := filterEntriesByDate(dataset.Entries, rangeKey, startDate, endDate)
	start, end := "", ""
	if len(entries) > 0 {
		start = entries[0].Date
		end = entries[len(entries)-1].Date
	}
	return XirrResponse{
		LifePortfolio:   computeLifePortfolio(entries, rangeKey, start, end),
		MarketPortfolio: computeMarketPortfolio(entries, rangeKey, start, end),
		PerAsset:        computePerAsset(entries, rangeKey, start, end),
	}
}

func computeLifePortfolio(entries []store.Entry, rangeKey, start, end string) XirrResult {
	flows := []CashFlow{}
	for _, entry := range entries {
		if entry.Income.InHand != nil && *entry.Income.InHand > 0 {
			flows = append(flows, CashFlow{Date: ParseDate(entry.Date), Amount: -*entry.Income.InHand})
		}
	}
	if len(entries) > 0 {
		derived := ComputeDerived(store.Dataset{Entries: entries})
		latest := derived[entries[len(entries)-1].ID]
		flows = append(flows, CashFlow{Date: ParseDate(entries[len(entries)-1].Date), Amount: latest.CurrentNetWorth})
	}
	return buildXirrResult(flows, rangeKey, start, end, nil)
}

func computeMarketPortfolio(entries []store.Entry, rangeKey, start, end string) XirrResult {
	flows := []CashFlow{}
	for i, entry := range entries {
		sum := 0.0
		if i == 0 {
			for _, asset := range store.CanonicalAssetOrder() {
				sum += entry.MarketAssets[asset].Invested
			}
		} else {
			prev := entries[i-1]
			for _, asset := range store.CanonicalAssetOrder() {
				sum += entry.MarketAssets[asset].Invested - prev.MarketAssets[asset].Invested
			}
		}
		if sum != 0 {
			flows = append(flows, CashFlow{Date: ParseDate(entry.Date), Amount: -sum})
		}
	}
	if len(entries) > 0 {
		latest := entries[len(entries)-1]
		current := 0.0
		for _, asset := range store.CanonicalAssetOrder() {
			current += latest.MarketAssets[asset].Current
		}
		flows = append(flows, CashFlow{Date: ParseDate(latest.Date), Amount: current})
	}
	return buildXirrResult(flows, rangeKey, start, end, nil)
}

func computePerAsset(entries []store.Entry, rangeKey, start, end string) XirrResult {
	perAsset := map[string]XirrAsset{}
	for _, asset := range store.CanonicalAssetOrder() {
		flows := []CashFlow{}
		for i, entry := range entries {
			value := entry.MarketAssets[asset]
			invested := value.Invested
			if i > 0 {
				invested -= entries[i-1].MarketAssets[asset].Invested
			}
			if invested != 0 {
				flows = append(flows, CashFlow{Date: ParseDate(entry.Date), Amount: -invested})
			}
		}
		investedTotal := 0.0
		currentTotal := 0.0
		if len(entries) > 0 {
			last := entries[len(entries)-1].MarketAssets[asset]
			investedTotal = last.Invested
			currentTotal = last.Current
			flows = append(flows, CashFlow{Date: ParseDate(entries[len(entries)-1].Date), Amount: currentTotal})
		}
		value, status, message := xirr(flows)
		perAsset[asset] = XirrAsset{
			Value:    value,
			Status:   status,
			Message:  message,
			Invested: investedTotal,
			Current:  currentTotal,
		}
	}
	return XirrResult{
		Status:    "ok",
		Message:   "Per-asset XIRR computed",
		PerAsset:  perAsset,
		RangeKey:  rangeKey,
		StartDate: start,
		EndDate:   end,
	}
}

func buildXirrResult(flows []CashFlow, rangeKey, start, end string, perAsset map[string]XirrAsset) XirrResult {
	value, status, message := xirr(flows)
	return XirrResult{
		Value:     value,
		Status:    status,
		Message:   message,
		CashFlows: flows,
		PerAsset:  perAsset,
		RangeKey:  rangeKey,
		StartDate: start,
		EndDate:   end,
	}
}

func xirr(flows []CashFlow) (*float64, string, string) {
	if len(flows) < 2 {
		return nil, "invalid", "Need at least one inflow and one outflow"
	}
	sort.Slice(flows, func(i, j int) bool { return flows[i].Date.Before(flows[j].Date) })
	hasPositive, hasNegative := false, false
	for _, flow := range flows {
		if flow.Amount > 0 {
			hasPositive = true
		}
		if flow.Amount < 0 {
			hasNegative = true
		}
	}
	if !hasPositive || !hasNegative {
		return nil, "invalid", "Cash flows must include both positive and negative values"
	}

	start := flows[0].Date
	rate := 0.10
	for i := 0; i < 100; i++ {
		fx := 0.0
		dfx := 0.0
		for _, flow := range flows {
			years := flow.Date.Sub(start).Hours() / 24 / 365
			base := math.Pow(1+rate, years)
			if math.IsNaN(base) || math.IsInf(base, 0) || 1+rate <= 0 {
				return nil, "invalid", "XIRR diverged due to invalid rate bounds"
			}
			fx += flow.Amount / base
			dfx -= (years * flow.Amount) / math.Pow(1+rate, years+1)
		}
		if math.Abs(dfx) < 1e-10 {
			return nil, "invalid", "XIRR derivative became unstable"
		}
		next := rate - (fx / dfx)
		if math.Abs(next-rate) < 1e-7 {
			result := next
			return &result, "ok", "Converged"
		}
		rate = next
	}
	return nil, "invalid", "XIRR did not converge in 100 iterations"
}

func filterEntriesByDate(entries []store.Entry, rangeKey string, startDate, endDate *time.Time) []store.Entry {
	base := FilterEntries(entries, rangeKey)
	if startDate == nil && endDate == nil {
		return base
	}
	filtered := []store.Entry{}
	for _, entry := range base {
		date := ParseDate(entry.Date)
		if startDate != nil && date.Before(*startDate) {
			continue
		}
		if endDate != nil && date.After(*endDate) {
			continue
		}
		filtered = append(filtered, entry)
	}
	return filtered
}
