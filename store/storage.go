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

const CurrentSchemaVersion = 2

var (
	ErrInvalidDataset = errors.New("invalid dataset")
	assetOrder        = []string{"mutualFunds", "nps", "stockMarket", "crypto"}
)

type Dataset struct {
	SchemaVersion  int                    `json:"schemaVersion"`
	Entries        []Entry                `json:"entries"`
	Meta           Meta                   `json:"meta"`
	IncomeHistory  []EffectiveDatedAmount `json:"incomeHistory"`
	ExpenseHistory []EffectiveDatedAmount `json:"expenseHistory"`
	Goals          []Goal                 `json:"goals"`
	Settings       UserSettings           `json:"settings"`
	Preferences    json.RawMessage        `json:"preferences,omitempty"`
}

// UnmarshalJSON keeps the default enabled for datasets created before the
// zero-return scenario preference was persisted. An explicit false in newer
// datasets is preserved by normal JSON decoding.
func (data *Dataset) UnmarshalJSON(raw []byte) error {
	type datasetJSON Dataset
	decoded := datasetJSON{
		Settings: UserSettings{ShowZeroReturnScenario: true},
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*data = Dataset(decoded)
	return nil
}

type Meta struct {
	Currency    string `json:"currency"`
	Created     string `json:"created"`
	LastUpdated string `json:"lastUpdated"`
}

type Entry struct {
	ID           string                 `json:"id"`
	Date         string                 `json:"date"`
	Liquid       LiquidAssets           `json:"liquid"`
	HardAssets   HardAssets             `json:"hardAssets"`
	MarketAssets map[string]MarketAsset `json:"marketAssets"`
	OneOffs      []OneOff               `json:"oneOffs"`
	ExpensesNote string                 `json:"expensesNote"`
}

type EffectiveDatedAmount struct {
	From          string  `json:"from"`
	MonthlyAmount float64 `json:"monthlyAmount"`
}

type Goal struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	TargetAmount float64 `json:"targetAmount"`
	TargetDate   string  `json:"targetDate,omitempty"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}

type OneOff struct {
	ID     string  `json:"id"`
	Type   string  `json:"type"`
	Amount float64 `json:"amount"`
	Label  string  `json:"label"`
}

type UserSettings struct {
	ProfileName               string   `json:"profileName"`
	Appearance                string   `json:"appearance"`
	NumberFormat              string   `json:"numberFormat"`
	DefaultLandingPage        string   `json:"defaultLandingPage"`
	HideAmountsByDefault      bool     `json:"hideAmountsByDefault"`
	AutoHideOnBlur            bool     `json:"autoHideOnBlur"`
	ReminderDayOfMonth        int      `json:"reminderDayOfMonth"`
	ExpectedMarketReturn      *float64 `json:"expectedMarketReturn"`
	ShowZeroReturnScenario    bool     `json:"showZeroReturnScenario"`
	EmergencyFundTargetMonths int      `json:"emergencyFundTargetMonths"`
}

type LiquidAssets struct {
	Bank   float64 `json:"bank"`
	Sodexo float64 `json:"sodexo"`
}

type HardAssets struct {
	StocksWallet float64 `json:"stocksWallet"`
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
	_ = MigrateDataset(&data)
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
	if err := MigrateDataset(&data); err != nil {
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
	if err := MigrateDataset(data); err != nil {
		return err
	}
	if data.Settings.Appearance != "light" && data.Settings.Appearance != "dark" && data.Settings.Appearance != "auto" {
		return fmt.Errorf("%w: invalid appearance setting", ErrInvalidDataset)
	}
	if data.Settings.NumberFormat != "indian" && data.Settings.NumberFormat != "international" {
		return fmt.Errorf("%w: invalid number format setting", ErrInvalidDataset)
	}
	if data.Settings.DefaultLandingPage != "dashboard" && data.Settings.DefaultLandingPage != "snapshots" && data.Settings.DefaultLandingPage != "analytics-overview" && data.Settings.DefaultLandingPage != "plan" {
		return fmt.Errorf("%w: invalid default landing page", ErrInvalidDataset)
	}
	if data.Settings.ReminderDayOfMonth < 1 || data.Settings.ReminderDayOfMonth > 28 || data.Settings.EmergencyFundTargetMonths < 1 {
		return fmt.Errorf("%w: reminder day must be 1-28 and emergency fund months must be positive", ErrInvalidDataset)
	}
	if data.Settings.ExpectedMarketReturn != nil && *data.Settings.ExpectedMarketReturn <= -1 {
		return fmt.Errorf("%w: expected market return must be greater than -100%%", ErrInvalidDataset)
	}
	if data.Meta.Currency == "" {
		data.Meta.Currency = "INR"
	}
	if len(data.Entries) == 0 {
		return fmt.Errorf("%w: dataset must contain at least one entry", ErrInvalidDataset)
	}

	seenEntries := map[string]bool{}
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
		if seenEntries[entry.ID] {
			return fmt.Errorf("%w: duplicate snapshot date %s", ErrInvalidDataset, entry.Date)
		}
		seenEntries[entry.ID] = true
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
		seenOneOffs := map[string]bool{}
		for _, oneOff := range entry.OneOffs {
			if oneOff.Type != "inflow" && oneOff.Type != "outflow" {
				return fmt.Errorf("%w: one-off type must be inflow or outflow", ErrInvalidDataset)
			}
			if oneOff.Amount <= 0 || strings.TrimSpace(oneOff.Label) == "" {
				return fmt.Errorf("%w: one-offs need a positive amount and label", ErrInvalidDataset)
			}
			if oneOff.ID == "" || seenOneOffs[oneOff.ID] {
				return fmt.Errorf("%w: one-off IDs must be present and unique per snapshot", ErrInvalidDataset)
			}
			seenOneOffs[oneOff.ID] = true
		}
	}
	for _, history := range [][]EffectiveDatedAmount{data.IncomeHistory, data.ExpenseHistory} {
		seen := map[string]bool{}
		for _, item := range history {
			if _, err := time.Parse("2006-01-02", item.From); err != nil || item.MonthlyAmount < 0 || seen[item.From] {
				return fmt.Errorf("%w: invalid or duplicate effective-dated monthly amount", ErrInvalidDataset)
			}
			seen[item.From] = true
		}
	}
	seenGoals := map[string]bool{}
	for _, goal := range data.Goals {
		if strings.TrimSpace(goal.ID) == "" || seenGoals[goal.ID] || strings.TrimSpace(goal.Name) == "" || goal.TargetAmount <= 0 || (goal.Type != "milestone" && goal.Type != "long-term") || goal.CreatedAt == "" || goal.UpdatedAt == "" {
			return fmt.Errorf("%w: goals need a name, type, and positive target", ErrInvalidDataset)
		}
		seenGoals[goal.ID] = true
		if goal.TargetDate != "" {
			if _, err := time.Parse("2006-01-02", goal.TargetDate); err != nil {
				return fmt.Errorf("%w: invalid goal target date", ErrInvalidDataset)
			}
		}
	}
	sort.Slice(data.IncomeHistory, func(i, j int) bool { return data.IncomeHistory[i].From < data.IncomeHistory[j].From })
	sort.Slice(data.ExpenseHistory, func(i, j int) bool { return data.ExpenseHistory[i].From < data.ExpenseHistory[j].From })
	sortEntries(data.Entries)
	return nil
}

func MigrateDataset(data *Dataset) error {
	if data.SchemaVersion > CurrentSchemaVersion {
		return fmt.Errorf("%w: schema version %d is newer than this app supports", ErrInvalidDataset, data.SchemaVersion)
	}
	if data.SchemaVersion < 2 {
		var legacy struct {
			ShortTermGoal *struct {
				TargetAmount float64 `json:"targetAmount"`
				TargetDate   string  `json:"targetDate"`
				CreatedAt    string  `json:"createdAt"`
				UpdatedAt    string  `json:"updatedAt"`
			} `json:"shortTermGoal"`
			Notifications json.RawMessage `json:"notifications"`
		}
		if len(data.Preferences) > 0 {
			if err := json.Unmarshal(data.Preferences, &legacy); err != nil {
				return fmt.Errorf("%w: could not migrate legacy preferences", ErrInvalidDataset)
			}
		}
		if len(data.Goals) == 0 && legacy.ShortTermGoal != nil && legacy.ShortTermGoal.TargetAmount > 0 {
			createdAt := legacy.ShortTermGoal.CreatedAt
			if createdAt == "" {
				createdAt = time.Now().UTC().Format(time.RFC3339)
			}
			updatedAt := legacy.ShortTermGoal.UpdatedAt
			if updatedAt == "" {
				updatedAt = createdAt
			}
			data.Goals = []Goal{{
				ID: "migrated-short-term-target", Name: "Short-term target", Type: "milestone",
				TargetAmount: legacy.ShortTermGoal.TargetAmount, TargetDate: legacy.ShortTermGoal.TargetDate,
				CreatedAt: createdAt, UpdatedAt: updatedAt,
			}}
		}
		preferences := map[string]any{"version": 2}
		if len(legacy.Notifications) > 0 && string(legacy.Notifications) != "null" {
			preferences["notifications"] = legacy.Notifications
		}
		migratedPreferences, err := json.Marshal(preferences)
		if err != nil {
			return err
		}
		data.Preferences = migratedPreferences
		data.SchemaVersion = CurrentSchemaVersion
	}
	if data.SchemaVersion == 0 {
		data.SchemaVersion = CurrentSchemaVersion
	}
	if len(data.Preferences) == 0 || string(data.Preferences) == "null" {
		data.Preferences = json.RawMessage(`{"version":2,"notifications":{}}`)
	}
	if data.Entries == nil {
		data.Entries = []Entry{}
	}
	for i := range data.Entries {
		if data.Entries[i].OneOffs == nil {
			data.Entries[i].OneOffs = []OneOff{}
		}
	}
	if data.IncomeHistory == nil {
		data.IncomeHistory = []EffectiveDatedAmount{}
	}
	if data.ExpenseHistory == nil {
		data.ExpenseHistory = []EffectiveDatedAmount{}
	}
	if data.Goals == nil {
		data.Goals = []Goal{}
	}
	if data.Settings.Appearance == "" {
		data.Settings.Appearance = "auto"
	}
	if data.Settings.NumberFormat == "" {
		data.Settings.NumberFormat = "indian"
	}
	if data.Settings.DefaultLandingPage == "" {
		data.Settings.DefaultLandingPage = "dashboard"
	}
	if data.Settings.ReminderDayOfMonth == 0 {
		data.Settings.ReminderDayOfMonth = 1
	}
	if data.Settings.EmergencyFundTargetMonths == 0 {
		data.Settings.EmergencyFundTargetMonths = 6
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
  "schemaVersion": 2,
  "entries": [
    {
      "id": "2025-01-31",
      "date": "2025-01-31",
      "liquid": { "bank": 42000, "sodexo": 3500 },
      "hardAssets": { "stocksWallet": 15000, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 180000, "current": 192500 },
        "nps": { "invested": 70000, "current": 74200 },
        "stockMarket": { "invested": 55000, "current": 53200 },
        "crypto": { "invested": 15000, "current": 16600 }
      },
      "oneOffs": [],
      "expensesNote": "Start of year rebalance and annual subscriptions"
    },
    {
      "id": "2025-02-28",
      "date": "2025-02-28",
      "liquid": { "bank": 47000, "sodexo": 3200 },
      "hardAssets": { "stocksWallet": 16000, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 188000, "current": 205400 },
        "nps": { "invested": 75000, "current": 80200 },
        "stockMarket": { "invested": 55500, "current": 57800 },
        "crypto": { "invested": 15200, "current": 19300 }
      },
      "oneOffs": [],
      "expensesNote": "Travel month with a slightly higher cash buffer"
    },
    {
      "id": "2025-03-31",
      "date": "2025-03-31",
      "liquid": { "bank": 52000, "sodexo": 3500 },
      "hardAssets": { "stocksWallet": 15500, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 196000, "current": 231000 },
        "nps": { "invested": 80000, "current": 88500 },
        "stockMarket": { "invested": 56000, "current": 54200 },
        "crypto": { "invested": 17100, "current": 19300 }
      },
      "oneOffs": [],
      "expensesNote": "Paid the annual insurance premium"
    },
    {
      "id": "2025-04-30",
      "date": "2025-04-30",
      "liquid": { "bank": 58500, "sodexo": 2800 },
      "hardAssets": { "stocksWallet": 16500, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 204000, "current": 218500 },
        "nps": { "invested": 85000, "current": 92100 },
        "stockMarket": { "invested": 57000, "current": 58500 },
        "crypto": { "invested": 18000, "current": 18300 }
      },
      "oneOffs": [
        { "id": "oo-2025-04-01", "type": "outflow", "amount": 12000, "label": "Advance tax self-assessment" }
      ],
      "expensesNote": "Tax season; advance tax out of the bank"
    },
    {
      "id": "2025-05-31",
      "date": "2025-05-31",
      "liquid": { "bank": 61000, "sodexo": 3400 },
      "hardAssets": { "stocksWallet": 17000, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 212000, "current": 236800 },
        "nps": { "invested": 90000, "current": 98700 },
        "stockMarket": { "invested": 57500, "current": 60100 },
        "crypto": { "invested": 18200, "current": 17800 }
      },
      "oneOffs": [],
      "expensesNote": "Steady month with contributions on autopilot"
    },
    {
      "id": "2025-06-30",
      "date": "2025-06-30",
      "liquid": { "bank": 55800, "sodexo": 2900 },
      "hardAssets": { "stocksWallet": 17600, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 220000, "current": 214100 },
        "nps": { "invested": 95000, "current": 101200 },
        "stockMarket": { "invested": 58000, "current": 52800 },
        "crypto": { "invested": 16900, "current": 16200 }
      },
      "oneOffs": [],
      "expensesNote": "Market correction month; stayed the course"
    },
    {
      "id": "2025-07-31",
      "date": "2025-07-31",
      "liquid": { "bank": 65500, "sodexo": 3300 },
      "hardAssets": { "stocksWallet": 18200, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 228000, "current": 227600 },
        "nps": { "invested": 100000, "current": 106400 },
        "stockMarket": { "invested": 58500, "current": 55400 },
        "crypto": { "invested": 17600, "current": 17400 }
      },
      "oneOffs": [],
      "expensesNote": "Emergency-fund top-up brought the bank buffer back on plan"
    },
    {
      "id": "2025-08-31",
      "date": "2025-08-31",
      "liquid": { "bank": 69500, "sodexo": 3150 },
      "hardAssets": { "stocksWallet": 18900, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 236000, "current": 245300 },
        "nps": { "invested": 105000, "current": 112900 },
        "stockMarket": { "invested": 59500, "current": 59300 },
        "crypto": { "invested": 18400, "current": 19600 }
      },
      "oneOffs": [],
      "expensesNote": "Monsoon month with low travel spend"
    },
    {
      "id": "2025-09-30",
      "date": "2025-09-30",
      "liquid": { "bank": 72500, "sodexo": 3600 },
      "hardAssets": { "stocksWallet": 19500, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 244000, "current": 259400 },
        "nps": { "invested": 110000, "current": 118700 },
        "stockMarket": { "invested": 60500, "current": 62800 },
        "crypto": { "invested": 19800, "current": 21400 }
      },
      "oneOffs": [],
      "expensesNote": "Festival month; small gold purchase booked in cash"
    },
    {
      "id": "2025-10-31",
      "date": "2025-10-31",
      "liquid": { "bank": 66800, "sodexo": 2780 },
      "hardAssets": { "stocksWallet": 20100, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 252000, "current": 247900 },
        "nps": { "invested": 115000, "current": 121800 },
        "stockMarket": { "invested": 61000, "current": 56900 },
        "crypto": { "invested": 20400, "current": 20600 }
      },
      "oneOffs": [
        { "id": "oo-2025-10-01", "type": "inflow", "amount": 40000, "label": "Annual performance bonus" },
        { "id": "oo-2025-10-02", "type": "outflow", "amount": 45000, "label": "Festival shopping and gifts" }
      ],
      "expensesNote": "Bonus in, festival spend out"
    },
    {
      "id": "2025-11-30",
      "date": "2025-11-30",
      "liquid": { "bank": 77500, "sodexo": 3500 },
      "hardAssets": { "stocksWallet": 20800, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 260000, "current": 271200 },
        "nps": { "invested": 120000, "current": 129100 },
        "stockMarket": { "invested": 62000, "current": 64700 },
        "crypto": { "invested": 21200, "current": 22100 }
      },
      "oneOffs": [],
      "expensesNote": "Quiet month; cash buffer back to plan"
    },
    {
      "id": "2025-12-31",
      "date": "2025-12-31",
      "liquid": { "bank": 73500, "sodexo": 3300 },
      "hardAssets": { "stocksWallet": 21400, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 268000, "current": 283500 },
        "nps": { "invested": 125000, "current": 135400 },
        "stockMarket": { "invested": 63000, "current": 61600 },
        "crypto": { "invested": 22600, "current": 24000 }
      },
      "oneOffs": [],
      "expensesNote": "Year-end rebalance and gift purchases"
    },
    {
      "id": "2026-01-31",
      "date": "2026-01-31",
      "liquid": { "bank": 81000, "sodexo": 3600 },
      "hardAssets": { "stocksWallet": 22100, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 276000, "current": 292100 },
        "nps": { "invested": 130000, "current": 140800 },
        "stockMarket": { "invested": 63500, "current": 64100 },
        "crypto": { "invested": 23200, "current": 23500 }
      },
      "oneOffs": [],
      "expensesNote": "New year budget reset"
    },
    {
      "id": "2026-02-28",
      "date": "2026-02-28",
      "liquid": { "bank": 87000, "sodexo": 3000 },
      "hardAssets": { "stocksWallet": 22800, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 284000, "current": 301400 },
        "nps": { "invested": 135000, "current": 146300 },
        "stockMarket": { "invested": 64000, "current": 66200 },
        "crypto": { "invested": 24700, "current": 25800 }
      },
      "oneOffs": [],
      "expensesNote": "Short month with steady contributions"
    },
    {
      "id": "2026-03-31",
      "date": "2026-03-31",
      "liquid": { "bank": 92000, "sodexo": 3700 },
      "hardAssets": { "stocksWallet": 23500, "fd": 100000 },
      "marketAssets": {
        "mutualFunds": { "invested": 292000, "current": 312700 },
        "nps": { "invested": 140000, "current": 152100 },
        "stockMarket": { "invested": 65000, "current": 69300 },
        "crypto": { "invested": 25100, "current": 25200 }
      },
      "oneOffs": [],
      "expensesNote": "Financial-year close; portfolio review done"
    }
  ],
  "meta": { "currency": "INR", "created": "2025-01-01", "lastUpdated": "2026-03-31" },
  "incomeHistory": [
    { "from": "2025-01-01", "monthlyAmount": 85000 },
    { "from": "2025-10-01", "monthlyAmount": 92000 },
    { "from": "2026-04-01", "monthlyAmount": 105000 }
  ],
  "expenseHistory": [
    { "from": "2025-01-01", "monthlyAmount": 14500 },
    { "from": "2025-09-01", "monthlyAmount": 16200 },
    { "from": "2026-02-01", "monthlyAmount": 17800 }
  ],
  "goals": [
    { "id": "goal-emergency-fund", "name": "Emergency fund to six months", "type": "milestone", "targetAmount": 300000, "targetDate": "2026-12-31", "createdAt": "2025-01-05T09:00:00Z", "updatedAt": "2025-03-31T09:00:00Z" },
    { "id": "goal-macbook", "name": "New MacBook Pro", "type": "milestone", "targetAmount": 190000, "targetDate": "2026-06-30", "createdAt": "2025-02-01T09:00:00Z", "updatedAt": "2025-02-01T09:00:00Z" },
    { "id": "goal-japan-trip", "name": "Japan trip fund", "type": "long-term", "targetAmount": 450000, "targetDate": "2027-03-31", "createdAt": "2025-03-01T09:00:00Z", "updatedAt": "2025-03-01T09:00:00Z" },
    { "id": "goal-home-seed", "name": "Home down-payment seed", "type": "long-term", "targetAmount": 1500000, "createdAt": "2025-03-01T09:00:00Z", "updatedAt": "2025-03-01T09:00:00Z" }
  ],
  "settings": { "profileName": "", "appearance": "auto", "numberFormat": "indian", "defaultLandingPage": "dashboard", "hideAmountsByDefault": false, "autoHideOnBlur": false, "reminderDayOfMonth": 1, "expectedMarketReturn": null, "showZeroReturnScenario": true, "emergencyFundTargetMonths": 6 },
  "preferences": { "version": 2, "notifications": {} }
}`

func CompactJSON(data Dataset) string {
	raw, _ := json.Marshal(data)
	return string(bytes.TrimSpace(raw))
}
