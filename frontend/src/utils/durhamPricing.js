/**
 * Durham ADI Chain Market Pricing Utility
 *
 * ADI/USD exchange rate: 1 ADI = $0.0001
 * Durham baseline property value: $567,400 (same as Raleigh)
 */

export const PRICE_PER_SQFT_USD = 63.04;
export const RESIDENTIAL_BASE_USD = 567400;
export const ADI_USD_RATE = 0.0001; // 1 ADI = $0.0001 USD

/**
 * Convert USD to ADI
 */
export function usdToAdi(usd) {
  return Math.round(usd / ADI_USD_RATE);
}

/**
 * Convert ADI to USD
 */
export function adiToUsd(adi) {
  return adi * ADI_USD_RATE;
}

/**
 * Format ADI value for display
 */
export function formatAdi(adi) {
  if (adi >= 1_000_000) {
    return `${(adi / 1_000_000).toFixed(2)}M ADI`;
  }
  if (adi >= 1_000) {
    return `${Math.round(adi / 1_000)}K ADI`;
  }
  return `${adi.toLocaleString()} ADI`;
}

/**
 * Format USD value for display
 */
export function formatUsd(usd) {
  if (usd >= 1_000_000) {
    return `$${(usd / 1_000_000).toFixed(1)}M`;
  }
  if (usd >= 1_000) {
    return `$${Math.round(usd / 1_000)}K`;
  }
  return `$${usd.toLocaleString()}`;
}

// Durham zoning ranks (simplified)
const ZONING_RANKS = {
  'AG':   -4,
  'R-40': -2,
  'R-20': -1,
  'R-10':  0,  // baseline
  'R-6':   1,
  'R-4':   2,
  'RX':    2,
  'NX':    3,
  'OX':    3,
  'TOD':   4,
  'CX':    4,
  'DX':    5,
  'IX':   -1,
  'IH':   -2,
};

const RESIDENTIAL_RANK = 0;
const STEP_FACTOR = 1.35;

export function getZoningMultiplier(zoningCode) {
  if (!zoningCode) return 1.0;

  const normalized = zoningCode.trim().toUpperCase().split(' ')[0];

  if (ZONING_RANKS[normalized] !== undefined) {
    const diff = ZONING_RANKS[normalized] - RESIDENTIAL_RANK;
    return Math.pow(STEP_FACTOR, diff);
  }

  // Fuzzy match
  for (const key of Object.keys(ZONING_RANKS)) {
    if (normalized.startsWith(key)) {
      const diff = ZONING_RANKS[key] - RESIDENTIAL_RANK;
      return Math.pow(STEP_FACTOR, diff);
    }
  }

  return 1.0;
}

/**
 * Estimate parcel value in both USD and ADI
 */
export function estimateParcelValue(zoningCode, areaSqft) {
  const multiplier = getZoningMultiplier(zoningCode);

  let valueUsd;
  if (areaSqft && areaSqft > 0) {
    valueUsd = Math.round(PRICE_PER_SQFT_USD * areaSqft * multiplier);
  } else {
    valueUsd = Math.round(RESIDENTIAL_BASE_USD * multiplier);
  }

  const valueAdi = usdToAdi(valueUsd);
  const valueAdiPerShare = Math.round(valueAdi / 1000); // 1000 shares per parcel
  const acreage = areaSqft ? (areaSqft / 43560).toFixed(2) : null;

  return {
    valueUsd,
    valueAdi,
    valueAdiPerShare,
    multiplier,
    zoningLabel: zoningCode || 'Unknown',
    areaSqft: areaSqft || null,
    acreage,
  };
}
