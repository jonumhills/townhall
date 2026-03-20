import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hedera, durham } from '../services/api';
import { estimateParcelValue, formatUsd, formatHbar, formatAdi } from '../utils/marketPricing';

/**
 * ListModal — owner lists their tokenized parcel shares for sale.
 *
 * Props:
 *   parcel       {object}  — token_registry row from tokenizedPinsRef
 *   wallet       {string}  — owner's Hedera account ID or ADI address
 *   onClose      {fn}
 *   onListed     {fn}      — called after successful listing (refreshes map layer)
 *   serviceType  {string}  — 'hedera' or 'durham'
 */
export default function ListModal({ parcel, wallet, onClose, onListed, serviceType = 'hedera' }) {
  const [sharesAmount, setSharesAmount] = useState('');
  const [priceHbar, setPriceHbar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const isDurham = serviceType === 'adi' || serviceType === 'durham';
  const service = isDurham ? durham : hedera;
  const tokenSymbol = isDurham ? 'ADI' : 'HBAR';

  console.log('🎯 ListModal serviceType:', serviceType, '| isDurham:', isDurham);

  const maxShares = parcel?.available_shares || parcel?.total_shares || 1000;
  const shares = parseInt(sharesAmount) || 0;
  const price = parseFloat(priceHbar) || 0;
  const totalValue = (shares * price).toFixed(2);

  // Zoning and area come from metadata stored at mint time
  // Handle both Hedera (metadata.current_zoning) and Durham (metadata.zoning.current) formats
  const zoning = parcel?.metadata?.current_zoning
    || parcel?.metadata?.zoning?.current
    || parcel?.metadata?.zoning?.proposed
    || (typeof parcel?.metadata?.zoning === 'string' ? parcel?.metadata?.zoning : null);
  const areaSqft = parcel?.metadata?.area_sqft || parcel?.area_sqft || null;
  const estValue = zoning ? estimateParcelValue(zoning, areaSqft) : null;

  const handleList = async () => {
    if (!shares || shares <= 0) {
      setError('Enter a valid number of shares.');
      return;
    }
    if (shares > maxShares) {
      setError(`You only have ${maxShares} shares available.`);
      return;
    }
    if (!price || price <= 0) {
      setError(`Enter a price per share in ${tokenSymbol}.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = {
        pin: parcel.pin,
        countyId: parcel.county_id,
        ownerAccountId: wallet,
        sharesAmount: shares,
      };

      if (isDurham) {
        params.priceAdi = price;
      } else {
        params.priceHbar = price;
      }

      const res = await service.listShares(params);
      setResult(res);
      onListed();
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

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="relative z-10 bg-black/95 border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-500/10 w-full max-w-md mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 px-6 py-4 border-b border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-emerald-400 font-black text-base uppercase tracking-wide">List Shares</h2>
                <p className="text-gray-500 text-xs font-mono">{parcel?.pin}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-lg text-gray-500 hover:text-red-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-4">
            {!result ? (
              <>
                {/* Parcel info */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Available Shares</span>
                    <span className="text-white font-black text-sm">{maxShares.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">County</span>
                    <span className="text-gray-300 text-xs">{parcel?.county_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Owner</span>
                    <span className="text-emerald-400 font-mono text-xs">{wallet}</span>
                  </div>
                </div>

                {/* Est. market value */}
                {estValue && (
                  <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Est. Market Value</p>
                      <p className="text-emerald-400 font-black text-lg">{isDurham ? formatAdi(estValue.valueAdi) : formatHbar(estValue.valueHbar)}</p>
                      <p className="text-gray-500 text-xs">{formatUsd(estValue.valueUsd)} · {zoning}</p>
                      {estValue.acreage && (
                        <p className="text-gray-600 text-xs">{estValue.acreage} ac · {Math.round(estValue.areaSqft).toLocaleString()} sqft</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-xs">Est. per share</p>
                      <p className="text-amber-400 font-black text-base">{isDurham ? `${estValue.valueAdiPerShare} ADI` : `${estValue.valueHbarPerShare} ℏ`}</p>
                    </div>
                  </div>
                )}

                {/* Shares input */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Shares to List
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={maxShares}
                    placeholder={`1 – ${maxShares}`}
                    value={sharesAmount}
                    onChange={(e) => { setSharesAmount(e.target.value); setError(''); }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>

                {/* Price input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Price per Share ({tokenSymbol})
                    </label>
                    {estValue && (
                      <button
                        type="button"
                        onClick={() => setPriceHbar(String(isDurham ? estValue.valueAdiPerShare : estValue.valueHbarPerShare))}
                        className="text-xs text-amber-500 hover:text-amber-400 font-bold transition-colors"
                      >
                        Use est. {isDurham ? `${estValue.valueAdiPerShare} ADI` : `${estValue.valueHbarPerShare} ℏ`}/share
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    placeholder="e.g. 5"
                    value={priceHbar}
                    onChange={(e) => { setPriceHbar(e.target.value); setError(''); }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>

                {/* Total value preview */}
                {shares > 0 && price > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-gray-400 text-sm">{shares} shares × {price} {tokenSymbol}</span>
                    <span className="text-emerald-400 font-black text-lg">{totalValue} {tokenSymbol}</span>
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleList}
                  disabled={loading || !shares || !price}
                  className="w-full bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/50 hover:to-teal-600/50 border border-emerald-500/40 text-emerald-400 font-black py-3 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
                >
                  {loading
                    ? <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Listing...
                      </span>
                    : `List ${shares || 0} Shares for Sale`
                  }
                </button>
              </>
            ) : (
              /* Success */
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-black text-lg">Shares Listed!</h3>
                  <p className="text-gray-400 text-sm mt-1">Your parcel is now open for investment.</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2 text-left">
                  <Row label="Shares Listed" value={String(result.listed_shares)} />
                  <Row label="Price / Share" value={`${isDurham ? result.price_adi : result.price_hbar} ${tokenSymbol}`} />
                  <Row label="Total Value" value={`${(result.listed_shares * (isDurham ? result.price_adi : result.price_hbar)).toFixed(2)} ${tokenSymbol}`} />
                  <Row label="Share Token" value={result.share_token_id} mono />
                </div>
                <button
                  onClick={onClose}
                  className="w-full bg-white/5 border border-white/10 text-gray-300 font-bold py-3 rounded-2xl hover:bg-white/10 transition-all"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-500 text-xs uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-white text-xs text-right ${mono ? 'font-mono' : 'font-medium'} break-all`}>{value || '—'}</span>
    </div>
  );
}
