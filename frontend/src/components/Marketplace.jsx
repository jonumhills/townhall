import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hedera, durham } from '../services/api';
import { formatHbar, formatAdi, formatUsd } from '../utils/marketPricing';

/**
 * Marketplace — shows all tokenized & listed parcels available for purchase
 *
 * Props:
 *   serviceType  {string}  'hedera', 'durham', or 'all'
 *   selectedCounty {string}  county filter
 *   onClose      {fn}
 *   onSelectParcel {fn(parcel)} - called when user clicks on a listing
 *   onFocusParcel {fn(pin, geometry)} - called when map icon is clicked to zoom to parcel
 */
export default function Marketplace({ serviceType = 'hedera', selectedCounty = 'all', onClose, onSelectParcel, onFocusParcel }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAll = serviceType === 'all';
  const isDurham = serviceType === 'durham' || serviceType === 'adi';
  const countyName = isAll ? 'All Counties' : isDurham ? 'Durham County' : 'Raleigh County';
  const tokenSymbol = isAll ? 'Multi-Chain' : isDurham ? 'ADI' : 'HBAR';

  console.log('🎯 Marketplace serviceType:', serviceType, '| isDurham:', isDurham, '| tokenSymbol:', tokenSymbol);

  useEffect(() => {
    loadListings();
  }, [serviceType, selectedCounty]);

  const loadListings = async () => {
    setLoading(true);
    setError('');
    try {
      let allListings = [];

      if (isAll) {
        // Fetch from both services when "all" is selected
        const [hederaResponse, durhamResponse] = await Promise.all([
          hedera.getListings('raleigh_nc').catch(() => ({ listings: [] })),
          durham.getListings('durham_nc').catch(() => ({ listings: [] }))
        ]);

        // Add blockchain_type to each listing for display
        const hederaListings = (hederaResponse.listings || []).map(l => ({ ...l, blockchain_type: 'hedera' }));
        const durhamListings = (durhamResponse.listings || []).map(l => ({ ...l, blockchain_type: 'adi' }));

        allListings = [...hederaListings, ...durhamListings];
      } else {
        // Fetch from specific service
        const service = isDurham ? durham : hedera;
        const countyId = isDurham ? 'durham_nc' : 'raleigh_nc';
        const response = await service.getListings(countyId);
        allListings = (response.listings || []).map(l => ({
          ...l,
          blockchain_type: isDurham ? 'adi' : 'hedera'
        }));
      }

      setListings(allListings);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 bg-black/95 border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-500/10 w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 px-6 py-4 border-b border-emerald-500/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-emerald-400 font-black text-lg uppercase tracking-wide">Marketplace</h2>
                  <p className="text-gray-500 text-xs">{countyName} • {tokenSymbol} Network</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Available Listings</p>
                  <p className="text-emerald-400 font-black text-lg">{listings.length}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-red-500/20 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="flex items-center gap-3 text-gray-500">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">Loading marketplace...</span>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                {error}
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">No listings available yet</p>
                <p className="text-gray-600 text-xs mt-1">Check back later for new parcels</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map((listing) => {
                  const listingTokenSymbol = listing.blockchain_type === 'adi' ? 'ADI' : 'HBAR';
                  return (
                    <ListingCard
                      key={`${listing.pin}-${listing.county_id}-${listing.blockchain_type}`}
                      listing={listing}
                      tokenSymbol={listingTokenSymbol}
                      onSelect={() => onSelectParcel(listing)}
                      onFocusParcel={onFocusParcel}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-6 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <button
                onClick={loadListings}
                disabled={loading}
                className="text-xs text-gray-500 hover:text-emerald-400 transition-colors flex items-center gap-2 disabled:opacity-40"
              >
                <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <p className="text-xs text-gray-600">Click on a listing to purchase shares</p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ListingCard({ listing, tokenSymbol, onSelect, onFocusParcel }) {
  const metadata = listing.metadata || {};
  const parcelName = metadata.name || listing.pin;
  const address = metadata.parcel?.address || metadata.parcel?.location || '';
  const currentZoning = metadata.zoning?.current_zoning || metadata.zoning?.current || '';
  const proposedZoning = metadata.zoning?.proposed_zoning || metadata.zoning?.proposed || '';

  const pricePerShare = listing.blockchain_type === 'adi' ? listing.price_adi : listing.price_hbar;
  const listedShares = listing.listed_shares || 0;
  const totalShares = listing.total_shares || 1000;
  const totalValue = (pricePerShare * listedShares).toFixed(2);
  const percentListed = ((listedShares / totalShares) * 100).toFixed(0);

  const hasGeometry = metadata.geometry;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="bg-white/5 border border-white/10 hover:border-emerald-500/30 rounded-2xl p-4 transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-sm truncate">{parcelName}</h3>
          <p className="text-gray-500 text-xs font-mono mt-0.5">{listing.pin}</p>
          {address && <p className="text-gray-600 text-xs mt-1 truncate">{address}</p>}
        </div>
        <div className="ml-3 shrink-0 flex items-center gap-2">
          {hasGeometry && onFocusParcel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFocusParcel(listing.pin, metadata.geometry);
              }}
              title="Locate on map"
              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg text-emerald-400 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-2 py-1">
            <p className="text-emerald-400 font-black text-xs">Listed</p>
          </div>
        </div>
      </div>

      {/* Zoning */}
      {currentZoning && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <span className="text-gray-500">{currentZoning}</span>
          <span className="text-emerald-500">→</span>
          <span className="text-gray-300">{proposedZoning}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Price/Share" value={pricePerShare} unit={tokenSymbol} />
        <Stat label="Available" value={listedShares} unit="shares" />
        <Stat label="Total Value" value={totalValue} unit={tokenSymbol} />
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">{percentListed}% of total shares</span>
          <span className="text-gray-500">{listedShares} / {totalShares}</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
            style={{ width: `${percentListed}%` }}
          />
        </div>
      </div>

      {/* Hover indicator */}
      <div
        onClick={onSelect}
        className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        <span className="text-emerald-400 text-xs font-bold">Click to buy shares</span>
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white font-black text-sm">{value}</p>
      <p className="text-gray-600 text-xs">{unit}</p>
    </div>
  );
}
