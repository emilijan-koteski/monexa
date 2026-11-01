package utils

import (
	"math"
	"math/big"
	"sort"
)

const (
	centsPerUnit = 100
	rateScale    = 1e10
)

func ToCents(amount float64) int64 {
	return int64(math.Round(amount * centsPerUnit))
}

func FromCents(cents int64) float64 {
	return float64(cents) / centsPerUnit
}

// RoundRate rounds an exchange rate to the 10 decimal places stored in the database.
func RoundRate(rate float64) float64 {
	return math.Round(rate*rateScale) / rateScale
}

// ConvertCents converts an amount in cents with a rate and rounds to the nearest cent.
func ConvertCents(cents int64, rate float64) int64 {
	return int64(math.Round(float64(cents) * rate))
}

// Allocate splits total across weights by the largest-remainder method, so the parts always sum to total.
// Ties go to the smaller tie key, which keeps a split stable when unrelated rows change.
func Allocate(total int64, weights []int64, tieKeys []uint) []int64 {
	parts := make([]int64, len(weights))
	sum := big.NewInt(0)
	for _, w := range weights {
		if w > 0 {
			sum.Add(sum, big.NewInt(w))
		}
	}
	if total <= 0 || sum.Sign() == 0 {
		return parts
	}

	remainders := make([]*big.Int, len(weights))
	allocated := int64(0)
	bigTotal := big.NewInt(total)
	for i, w := range weights {
		remainders[i] = big.NewInt(0)
		if w <= 0 {
			continue
		}
		product := new(big.Int).Mul(bigTotal, big.NewInt(w))
		quotient, remainder := new(big.Int).QuoRem(product, sum, new(big.Int))
		parts[i] = quotient.Int64()
		remainders[i] = remainder
		allocated += parts[i]
	}

	order := make([]int, 0, len(weights))
	for i, w := range weights {
		if w > 0 {
			order = append(order, i)
		}
	}
	sort.SliceStable(order, func(a, b int) bool {
		ia, ib := order[a], order[b]
		if c := remainders[ia].Cmp(remainders[ib]); c != 0 {
			return c > 0
		}
		return tieKey(tieKeys, ia) < tieKey(tieKeys, ib)
	})
	for k := int64(0); k < total-allocated; k++ {
		parts[order[int(k)%len(order)]]++
	}
	return parts
}

func tieKey(keys []uint, index int) uint {
	if index < len(keys) {
		return keys[index]
	}
	return uint(index)
}
