/**
 * API Client for Townhall Backend
 */
import axios from 'axios';

// In production (Vercel), VITE_API_BASE_URL is baked at build time pointing to Railway.
// In local dev, fall back to /api so Vite proxy forwards to localhost:8000.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Raleigh service client (port 3001 proxied via /raleigh in vite.config.js)
const raleighClient = axios.create({
  baseURL: '/raleigh',
  headers: { 'Content-Type': 'application/json' },
});

// Durham service client (port 3002 proxied via /durham in vite.config.js)
const durhamClient = axios.create({
  baseURL: '/durham',
  headers: { 'Content-Type': 'application/json' },
});

// ── FastAPI methods ───────────────────────────────────────────────────────────
export const api = {
  getStats: async () => {
    const response = await apiClient.get('/stats');
    return response.data;
  },

  getCounties: async () => {
    const response = await apiClient.get('/counties');
    return response.data;
  },

  getCounty: async (countyId) => {
    const response = await apiClient.get(`/counties/${countyId}`);
    return response.data;
  },

  getPetitions: async (countyId, params = {}) => {
    const response = await apiClient.get(`/counties/${countyId}/petitions`, { params });
    return response.data;
  },

  getPetition: async (countyId, petitionNumber) => {
    const response = await apiClient.get(`/counties/${countyId}/petitions/${petitionNumber}`);
    return response.data;
  },

  getMeetings: async (countyId, params = {}) => {
    const response = await apiClient.get(`/counties/${countyId}/meetings`, { params });
    return response.data;
  },

  getParcelsGeoJSON: async (countyId) => {
    const response = await apiClient.get(`/counties/${countyId}/parcels/geojson`);
    return response.data;
  },

  // Lender verification endpoint
  verifyParcelForLender: async (pin, countyId) => {
    const response = await apiClient.get(`/lender/verify/${pin}`, { params: { county_id: countyId } });
    return response.data;
  },
};

// ── Raleigh service methods (port 3001) ────────────────────────────────────────
export const hedera = {
  // Get all tokenized parcel PINs — used to render the gold map layer
  getTokenized: async (countyId) => {
    const params = countyId ? { countyId } : {};
    const response = await raleighClient.get('/token/tokenized', { params });
    return response.data; // { tokenized: [...] }
  },

  // Verify a parcel PIN exists and is not yet tokenized
  verifyDeed: async ({ pin, countyId, ownerAccountId }) => {
    const response = await raleighClient.post('/token/verify-deed', { pin, countyId, ownerAccountId });
    return response.data;
  },

  // Mint NFT deed + 1000 shares for a parcel
  mintParcel: async ({ pin, countyId, ownerAccountId, priceHbar }) => {
    const response = await raleighClient.post('/token/mint', { pin, countyId, ownerAccountId, priceHbar });
    return response.data;
  },

  // List shares for sale
  listShares: async ({ pin, countyId, ownerAccountId, sharesAmount, priceHbar }) => {
    const response = await raleighClient.post('/market/list', { pin, countyId, ownerAccountId, sharesAmount, priceHbar });
    return response.data;
  },

  // Buy shares from a listed parcel
  buyShares: async ({ pin, countyId, buyerAccountId, sharesAmount, txHashFromBuyer }) => {
    const response = await raleighClient.post('/market/buy', { pin, countyId, buyerAccountId, sharesAmount, txHashFromBuyer });
    return response.data;
  },

  // All active market listings
  getListings: async (countyId) => {
    const params = countyId ? { countyId } : {};
    const response = await raleighClient.get('/market/listings', { params });
    return response.data; // { listings: [...] }
  },

  // Wallet portfolio (shares purchased as buyer)
  getPortfolio: async (walletId) => {
    const response = await raleighClient.get(`/market/portfolio/${walletId}`);
    return response.data;
  },

  // Parcels owned (minted/claimed) by wallet — from token_registry
  getOwned: async (walletId) => {
    const response = await raleighClient.get(`/market/owned/${walletId}`);
    return response.data; // { owned: [...] }
  },
};

// ── Durham service methods (port 3002) ────────────────────────────────────────
export const durham = {
  // Verify deed — check if parcel exists and is available
  verifyDeed: async ({ pin, countyId, ownerAccountId }) => {
    const response = await durhamClient.post('/token/verify-deed', { pin, countyId, ownerAccountId });
    return response.data;
  },

  // Submit claim for admin review (with deed PDF upload)
  submitClaim: async ({ pin, countyId, ownerAccountId, priceAdi, deedDocumentBase64 }) => {
    const response = await durhamClient.post('/token/submit-claim', { pin, countyId, ownerAccountId, priceAdi, deedDocumentBase64 });
    return response.data;
  },

  // Get all tokenized parcels (approved & minted)
  getTokenized: async (countyId = 'durham_nc') => {
    const params = { countyId };
    const response = await durhamClient.get('/token/tokenized', { params });
    return response.data;
  },

  // List shares for sale
  listShares: async ({ pin, countyId, ownerAccountId, sharesAmount, priceAdi }) => {
    const response = await durhamClient.post('/market/list', { pin, countyId, ownerAccountId, sharesAmount, priceAdi });
    return response.data;
  },

  // Buy shares
  buyShares: async ({ pin, countyId, buyerAccountId, sharesAmount, txHashFromBuyer }) => {
    const response = await durhamClient.post('/market/buy', { pin, countyId, buyerAccountId, sharesAmount, txHashFromBuyer });
    return response.data;
  },

  // Get active listings
  getListings: async (countyId = 'durham_nc') => {
    const params = { countyId };
    const response = await durhamClient.get('/market/listings', { params });
    return response.data;
  },

  // Get buyer's portfolio (shares purchased)
  getPortfolio: async (wallet) => {
    const response = await durhamClient.get(`/market/portfolio/${wallet}`);
    return response.data;
  },

  // Get owned parcels (minted by wallet)
  getOwned: async (wallet) => {
    const response = await durhamClient.get(`/market/owned/${wallet}`);
    return response.data;
  },

  // ── Admin endpoints ──────────────────────────────────────────────────────────

  // Get pending claims awaiting review
  getPendingClaims: async (countyId = 'durham_nc') => {
    const params = { countyId };
    const response = await durhamClient.get('/token/admin/pending-claims', { params });
    return response.data;
  },

  // Approve or reject a claim
  approveClaim: async ({ claimId, approved, notes, verifiedBy }) => {
    const response = await durhamClient.post('/token/admin/approve-claim', { claimId, approved, notes, verifiedBy });
    return response.data;
  },
};

export default api;
