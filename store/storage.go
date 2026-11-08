package store

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var (
	ErrInvalidDataset = errors.New("invalid dataset")
	assetOrder        = []string{"mutual_funds", "nps", "stock_market", "crypto"}
)

type Dataset struct {
	Entries     []Entry         `json:"entries"`
	Meta        Meta            `json:"meta"`
	Preferences json.RawMessage `json:"preferences,omitempty"`
}

type Meta struct {
	Currency    string `json:"currency"`
	Created     string `json:"created"`
	LastUpdated string `json:"last_updated"`
}

type Entry struct {
	ID           string                 `json:"id"`
	Date         string                 `json:"date"`
	Income       Income                 `json:"income"`
	Liquid       LiquidAssets           `json:"liquid"`
	HardAssets   HardAssets             `json:"hard_assets"`
	MarketAssets map[string]MarketAsset `json:"market_assets"`
	SIP          map[string]*float64    `json:"sip,omitempty"`
	ExpensesNote string                 `json:"expenses_note"`
}

type Income struct {
	InHand *float64 `json:"in_hand"`
}

type LiquidAssets struct {
	Bank   float64 `json:"bank"`
	Sodexo float64 `json:"sodexo"`
}

type HardAssets struct {
	StocksWallet float64 `json:"stocks_wallet"`
	FD           float64 `json:"fd"`
}

type MarketAsset struct {
	Invested float64 `json:"invested"`
	Current  float64 `json:"current"`
}

type SyncMetadata struct {
	FileExists   bool   `json:"fileExists"`
	FileUpdated  string `json:"fileUpdated"`
	FileCurrency string `json:"fileCurrency"`
}

func NewSampleDataset() Dataset {
	var data Dataset
	_ = json.Unmarshal([]byte(sampleData), &data)
	return data
}

func EnsureFile(path string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return SaveDataset(path, NewSampleDataset())
}

func LoadDataset(path string) (Dataset, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Dataset{}, err
	}

	var data Dataset
	if err := json.Unmarshal(raw, &data); err != nil {
		return Dataset{}, err
	}
	if err := ValidateDataset(&data); err != nil {
		return Dataset{}, err
	}
	sortEntries(data.Entries)
	return data, nil
}

func SaveDataset(path string, data Dataset) error {
	if err := ValidateDataset(&data); err != nil {
		return err
	}

	now := time.Now().Format("2006-01-02")
	if strings.TrimSpace(data.Meta.Currency) == "" {
		data.Meta.Currency = "INR"
	}
	if strings.TrimSpace(data.Meta.Created) == "" {
		data.Meta.Created = now
	}
	data.Meta.LastUpdated = now
	sortEntries(data.Entries)

	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	out = append(out, '\n')

	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, "data-*.json")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := tmp.Write(out); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

func SyncInfo(path string) SyncMetadata {
	info := SyncMetadata{}
	stat, err := os.Stat(path)
	if err != nil {
		return info
	}
	data, err := LoadDataset(path)
	if err != nil {
		return info
	}
	info.FileExists = true
	info.FileUpdated = stat.ModTime().UTC().Format(time.RFC3339)
	info.FileCurrency = data.Meta.Currency
	return info
}

func ValidateDataset(data *Dataset) error {
	if data.Meta.Currency == "" {
		data.Meta.Currency = "INR"
	}
	if len(data.Entries) == 0 {
		return fmt.Errorf("%w: dataset must contain at least one entry", ErrInvalidDataset)
	}

	for i := range data.Entries {
		entry := &data.Entries[i]
		_, err := time.Parse("2006-01-02", entry.Date)
		if err != nil {
			return fmt.Errorf("%w: invalid date for %s", ErrInvalidDataset, entry.ID)
		}
		expectedID := entry.Date
		if entry.ID != expectedID {
			return fmt.Errorf("%w: id %s must match date %s", ErrInvalidDataset, entry.ID, expectedID)
		}
		if entry.MarketAssets == nil {
			entry.MarketAssets = map[string]MarketAsset{}
		}
		for _, asset := range assetOrder {
			value, ok := entry.MarketAssets[asset]
			if !ok {
				entry.MarketAssets[asset] = MarketAsset{}
				continue
			}
			if value.Invested < 0 || value.Current < 0 {
				return fmt.Errorf("%w: market assets cannot be negative", ErrInvalidDataset)
			}
		}
		if entry.SIP == nil {
			entry.SIP = map[string]*float64{}
		}
		for key, value := range entry.SIP {
			if value != nil && *value < 0 {
				return fmt.Errorf("%w: sip for %s cannot be negative", ErrInvalidDataset, key)
			}
		}
	}
	return nil
}

func CanonicalAssetOrder() []string {
	out := make([]string, len(assetOrder))
	copy(out, assetOrder)
	return out
}

func sortEntries(entries []Entry) {
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Date < entries[j].Date
	})
}

const sampleData = `{
  "entries": [
    {
      "id": "2025-01-31",
      "date": "2025-01-31",
      "income": { "in_hand": 85000 },
      "liquid": { "bank": 42000, "sodexo": 3500 },
      "hard_assets": { "stocks_wallet": 15000, "fd": 100000 },
      "market_assets": {
        "mutual_funds": { "invested": 180000, "current": 192500 },
        "nps": { "invested": 70000, "current": 74200 },
        "stock_market": { "invested": 55000, "current": 53200 },
        "crypto": { "invested": 15000, "current": 16600 }
      },
      "sip": {
        "mutual_funds": 10000,
        "nps": 5000,
        "stock_market": 4000,
        "crypto": 1000
      },
      "expenses_note": "Start of year rebalance and annual subscriptions"
    },
    {
      "id": "2025-02-28",
      "date": "2025-02-28",
      "income": { "in_hand": 86000 },
      "liquid": { "bank": 47000, "sodexo": 3200 },
      "hard_assets": { "stocks_wallet": 16000, "fd": 100000 },
      "market_assets": {
        "mutual_funds": { "invested": 190000, "current": 205400 },
        "nps": { "invested": 75000, "current": 80200 },
        "stock_market": { "invested": 59000, "current": 57800 },
        "crypto": { "invested": 17000, "current": 19300 }
      },
      "sip": {
        "mutual_funds": 10000,
        "nps": 5000,
        "stock_market": 4000,
        "crypto": 2000
      },
      "expenses_note": "Travel month with slightly higher cash buffer"
    },
    {
      "id": "2025-03-31",
      "date": "2025-03-31",
      "income": { "in_hand": 88000 },
      "liquid": { "bank": 52000, "sodexo": 3500 },
      "hard_assets": { "stocks_wallet": 15000, "fd": 100000 },
      "market_assets": {
        "mutual_funds": { "invested": 200000, "current": 231000 },
        "nps": { "invested": 80000, "current": 88500 },
        "stock_market": { "invested": 60000, "current": 54200 },
        "crypto": { "invested": 20000, "current": 27400 }
      },
      "sip": {
        "mutual_funds": 10000,
        "nps": 5000,
        "stock_market": 1000,
        "crypto": 3000
      },
      "expenses_note": "Paid insurance premium"
    }
  ],
  "meta": { "currency": "INR", "created": "2025-01-01", "last_updated": "2025-03-31" }
}`

func CompactJSON(data Dataset) string {
	raw, _ := json.Marshal(data)
	return string(bytes.TrimSpace(raw))
}
