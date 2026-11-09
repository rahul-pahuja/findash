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
		MarketPortfolio: computeMarketPortfolio(entries, rangeKey, start, end),
		PerAsset:        computePerAsset(entries, rangeKey, start, end),
	}
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
	years := make([]float64, len(flows))
	for i, flow := range flows {
		years[i] = flow.Date.Sub(start).Hours() / 24 / 365
	}
	// Scale each NPV evaluation by its largest discount exponent. This keeps
	// rates close to -100% finite while preserving the sign needed for bisection.
	npv := func(rate float64) float64 {
		if rate <= -1 {
			return math.NaN()
		}
		logBase := math.Log1p(rate)
		maxExponent := math.Inf(-1)
		exponents := make([]float64, len(flows))
		for i, year := range years {
			exponents[i] = -year * logBase
			if exponents[i] > maxExponent {
				maxExponent = exponents[i]
			}
		}
		value := 0.0
		for i, flow := range flows {
			value += flow.Amount * math.Exp(exponents[i]-maxExponent)
		}
		return value
	}

	// A Newton step can jump below -100% when the initial estimate is far from
	// the answer. Probe outward from zero, then bisect the first sign-changing
	// interval so large losses and uneven contributions still produce an XIRR.
	rates := []float64{0, -0.1, 0.1, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75, -0.9, 0.9, -0.99, 1, -0.999, 2, -0.9999, 5, -0.999999, 10, -0.999999999, 100, 1000, 1e6}
	previousRate := rates[0]
	previousValue := npv(previousRate)
	if math.Abs(previousValue) < 1e-12 {
		result := 0.0
		return &result, "ok", "Converged"
	}
	for _, rate := range rates[1:] {
		value := npv(rate)
		if math.IsNaN(value) || math.IsInf(value, 0) {
			previousRate, previousValue = rate, value
			continue
		}
		if value == 0 {
			result := rate
			return &result, "ok", "Converged"
		}
		if !math.IsNaN(previousValue) && !math.IsInf(previousValue, 0) && (value < 0) != (previousValue < 0) {
			low, high := previousRate, rate
			lowValue := previousValue
			if low > high {
				low, high = high, low
				lowValue = value
			}
			for i := 0; i < 160; i++ {
				mid := low + (high-low)/2
				midValue := npv(mid)
				if midValue == 0 {
					low, high = mid, mid
					break
				}
				if (midValue < 0) == (lowValue < 0) {
					low, lowValue = mid, midValue
				} else {
					high = mid
				}
				if math.Abs(high-low) <= 1e-10*math.Max(1, math.Abs(mid)) {
					break
				}
			}
			result := low + (high-low)/2
			return &result, "ok", "Converged"
		}
		previousRate, previousValue = rate, value
	}
	return nil, "invalid", "XIRR root could not be bracketed"
}

func filterEntriesByDate(entries []store.Entry, rangeKey string, startDate, endDate *time.Time) []store.Entry {
	base := FilterEntries(entries, rangeKey)
	if startDate != nil || endDate != nil {
		base = append([]store.Entry(nil), entries...)
	}
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
