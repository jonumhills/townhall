/**
 * Market Pricing Utility — Townhall
 *
 * Baseline: Average of median land prices across 5 Raleigh zip codes
 * fetched from Rentcast API (5 API calls consumed):
 *   27601: $297,000 (7 listings)
 *   27603: $250,000 (28 listings)
 *   27606: $470,000 (15 listings)
 *   27607: $925,000 (4 listings)
 *   27609: $895,000 (2 listings)
 *   Average = $567,400
 *
 * Median Raleigh R-10 lot size ≈ 9,000 sq ft (derived from Raleigh parcel data).
 * Price per sq ft = $567,400 / 9,000 ≈ $63.04/sqft (baseline for R-10 residential).
 *
 * Multiplier formula:
 *   rank_diff = parcel_zoning_rank - RESIDENTIAL_RANK
 *   multiplier = BASE_MULTIPLIER ^ rank_diff
 *   (zones higher than residential cost more, lower cost less)
 *
 * Area-based formula:
 *   valueUsd = PRICE_PER_SQFT_USD × area_sqft × zoning_multiplier
 *   (falls back to flat RESIDENTIAL_BASE_USD × multiplier if area is unknown)
 */

// Median price per sq ft for R-10 residential in Raleigh (USD)
// = $567,400 median listing price / 9,000 sqft median R-10 lot
export const PRICE_PER_SQFT_USD = 63.04;

// Kept for reference / fallback (median listing price, whole parcel)
export const RESIDENTIAL_BASE_USD = 567400;

// HBAR/USD exchange rate — hardcoded for demo (HBAR ≈ $0.18 as of Feb 2026)
// Update this when you integrate a live price feed
export const HBAR_USD_RATE = 0.18; // 1 HBAR = $0.18 USD

// ADI/USD exchange rate — hardcoded for demo (ADI ≈ $2.50 as of Feb 2026)
export const ADI_USD_RATE = 2.50; // 1 ADI = $2.50 USD

/**
 * Convert USD to HBAR
 * @param {number} usd
 * @returns {number} hbar (rounded to nearest whole HBAR)
 */
export function usdToHbar(usd) {
  return Math.round(usd / HBAR_USD_RATE);
}

/**
 * Convert USD to ADI
 * @param {number} usd
 * @returns {number} adi (rounded to 2 decimals)
 */
export function usdToAdi(usd) {
  return Math.round((usd / ADI_USD_RATE) * 100) / 100;
}

/**
 * Format HBAR value for display (e.g. 3152222 → "3.15M ℏ")
 * @param {number} hbar
 * @returns {string}
 */
export function formatHbar(hbar) {
  if (hbar >= 1_000_000) {
    return `${(hbar / 1_000_000).toFixed(2)}M ℏ`;
  }
  if (hbar >= 1_000) {
    return `${Math.round(hbar / 1_000)}K ℏ`;
  }
  return `${hbar.toLocaleString()} ℏ`;
}

/**
 * Format ADI value for display (e.g. 226960 → "226.96K ADI")
 * @param {number} adi
 * @returns {string}
 */
export function formatAdi(adi) {
  if (adi >= 1_000_000) {
    return `${(adi / 1_000_000).toFixed(2)}M ADI`;
  }
  if (adi >= 1_000) {
    return `${(adi / 1_000).toFixed(2)}K ADI`;
  }
  return `${adi.toLocaleString()} ADI`;
}

// Rank table — all Raleigh UDO zoning codes, ordered by relative land value
// Rank 0 = baseline residential (R-10 is the most common mid-density residential)
// Positive rank = more valuable than residential
// Negative rank = less valuable than residential
const ZONING_RANKS = {
  // ── Agricultural / Conservation (lowest value) ──────────────────────────
  'AG':   -4,
  'EX':   -4, // extraction
  'CON':  -4, // conservation
  'OS':   -3, // open space

  // ── Residential — low density (slightly below baseline) ─────────────────
  'R-40': -2, // very large lot, low density
  'R-20': -1, // large lot
  'R-10':  0, // BASELINE — standard residential (most common)
  'R-6':   1, // smaller lots, higher density
  'R-4':   2, // dense residential

  // ── Residential Mixed-Use ────────────────────────────────────────────────
  'RX':    2, // residential mixed (allows some commercial)
  'RX-3':  2,

  // ── Neighborhood Mixed-Use ───────────────────────────────────────────────
  'NX':    3, // neighborhood mixed-use
  'NX-1':  3,
  'NX-2':  3,
  'NX-3':  3,

  // ── Office / Institutional Mixed-Use ────────────────────────────────────
  'OX':    3, // office mixed-use
  'OX-1':  3,
  'OX-2':  3,

  // ── Transit-Oriented Development ─────────────────────────────────────────
  'TOD':   4, // transit-oriented development (premium near transit)
  'TOD-R': 4,
  'TOD-E': 4,

  // ── Commercial Mixed-Use ─────────────────────────────────────────────────
  'CX':    4, // commercial mixed-use
  'CX-1':  4,
  'CX-2':  4,
  'CX-3':  4,

  // ── Downtown Mixed-Use (highest value) ──────────────────────────────────
  'DX':    5, // downtown mixed-use (highest residential)
  'DX-2':  5,
  'DX-3':  5,
  'DX-5':  5,
  'DX-7':  5,
  'DX-12': 5,

  // ── Industrial (below residential, not residential) ──────────────────────
  'IX':   -1, // light industrial
  'IX-1': -1,
  'IH':   -2, // heavy industrial
};

// The rank of our baseline residential zone
const RESIDENTIAL_RANK = ZONING_RANKS['R-10']; // = 0

// Each rank step multiplies (or divides) the value by this factor
const STEP_FACTOR = 1.35;

/**
 * Compute the zoning multiplier for a given zoning code.
 * multiplier = STEP_FACTOR ^ (zone_rank - residential_rank)
 *
 * Examples:
 *   R-10 → rank 0 → diff 0 → multiplier 1.00 → $567,400
 *   R-4  → rank 2 → diff 2 → multiplier 1.82 → $1,032,000
 *   DX   → rank 5 → diff 5 → multiplier 4.65 → $2,638,000
 *   R-40 → rank-2 → diff-2 → multiplier 0.55 → $311,000
 *
 * @param {string} zoningCode - raw zoning string from parcel data (e.g. "R-10", "DX-3")
 * @returns {number} multiplier (always > 0)
 */
export function getZoningMultiplier(zoningCode) {
  if (!zoningCode) return 1.0;

  // Normalize: uppercase, trim, strip trailing whitespace / suffixes after space
  const normalized = zoningCode.trim().toUpperCase().split(' ')[0];

  // Direct lookup
  if (ZONING_RANKS[normalized] !== undefined) {
    const diff = ZONING_RANKS[normalized] - RESIDENTIAL_RANK;
    return Math.pow(STEP_FACTOR, diff);
  }

  // Fuzzy prefix match — strip trailing digits/dashes to find base zone
  for (const key of Object.keys(ZONING_RANKS)) {
    if (normalized.startsWith(key)) {
      const diff = ZONING_RANKS[key] - RESIDENTIAL_RANK;
      return Math.pow(STEP_FACTOR, diff);
    }
  }

  // Unknown zone — treat as baseline residential
  return 1.0;
}

/**
 * Estimate the market value of a parcel given its zoning code and area.
 *
 * When areaSqft is provided:
 *   valueUsd = PRICE_PER_SQFT_USD × areaSqft × zoning_multiplier
 *
 * When areaSqft is null / undefined (fallback):
 *   valueUsd = RESIDENTIAL_BASE_USD × zoning_multiplier
 *   (flat median-parcel-price approach — same as before)
 *
 * Returns USD, HBAR, and ADI values, plus per-share values (1000 shares total),
 * plus acreage for display.
 *
 * @param {string} zoningCode
 * @param {number|null} [areaSqft] - parcel area in square feet (from backend)
 * @returns {{ valueUsd, valueHbar, valueAdi, valueHbarPerShare, valueAdiPerShare, multiplier, zoningLabel, areaSqft, acreage }}
 */
export function estimateParcelValue(zoningCode, areaSqft) {
  const multiplier = getZoningMultiplier(zoningCode);

  let valueUsd;
  if (areaSqft && areaSqft > 0) {
    valueUsd = Math.round(PRICE_PER_SQFT_USD * areaSqft * multiplier);
  } else {
    valueUsd = Math.round(RESIDENTIAL_BASE_USD * multiplier);
  }

  const valueHbar = usdToHbar(valueUsd);
  const valueAdi = usdToAdi(valueUsd);
  const valueHbarPerShare = Math.round(valueHbar / 1000); // 1000 shares per parcel
  const valueAdiPerShare = Math.round((valueAdi / 1000) * 100) / 100; // 1000 shares per parcel
  const acreage = areaSqft ? (areaSqft / 43560).toFixed(2) : null; // 1 acre = 43,560 sqft

  return {
    valueUsd,
    valueHbar,
    valueAdi,
    valueHbarPerShare,
    valueAdiPerShare,
    multiplier,
    zoningLabel: zoningCode || 'Unknown',
    areaSqft: areaSqft || null,
    acreage,
  };
}

/**
 * Format a USD value for display (e.g. 1234567 → "$1.2M")
 *
 * @param {number} usd
 * @returns {string}
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
