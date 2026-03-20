import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hedera, durham } from '../services/api';

/**
 * BuyPanel — displayed when user clicks a gold (tokenized + listed) parcel.
 * Shows listing info and lets the buyer purchase shares.
 *
 * Props:
 *   listing      {object}  — row from token_registry (pin, share_token_id, listed_shares, price_hbar/price_adi, owner_wallet, metadata)
 *   wallet       {string}  — connected buyer Hedera account ID or ADI address
 *   onClose      {fn}
 *   onBought     {fn}      — called after successful purchase
 *   serviceType  {string}  — 'hedera' or 'durham'
 */
export default function BuyPanel({ listing, wallet, onClose, onBought, serviceType = 'hedera' }) {
  const [sharesAmount, setSharesAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  const isDurham = serviceType === 'adi' || serviceType === 'durham';
  const service = isDurham ? durham : hedera;
  const tokenSymbol = isDurham ? 'ADI' : 'HBAR';

  console.log('🎯 BuyPanel serviceType:', serviceType, '| isDurham:', isDurham);

  const maxShares = listing.listed_shares || 0;
  const pricePerShare = isDurham ? (listing.price_adi || 0) : (listing.price_hbar || 0);
  const shares = parseInt(sharesAmount) || 0;
  const totalCost = (shares * pricePerShare).toFixed(2);

  const metadata = listing.metadata || {};
  const parcelName = metadata.name || listing.pin;
  const address = metadata.parcel?.address || metadata.parcel?.location || '';
  const currentZoning = metadata.zoning?.current_zoning || metadata.zoning?.current || '';
  const proposedZoning = metadata.zoning?.proposed_zoning || metadata.zoning?.proposed || '';

  const handleBuy = async () => {
    if (!shares || shares <= 0) {
      setError('Enter a valid number of shares.');
      return;
    }
    if (shares > maxShares) {
      setError(`Only ${maxShares} shares available.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await service.buyShares({
        pin: listing.pin,
        countyId: listing.county_id,
        buyerAccountId: wallet,
        sharesAmount: shares,
        txHashFromBuyer: null, // MVP: operator handles payment internally
      });
      setReceipt(result);
      onBought();
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
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="relative z-10 bg-black/95 border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/10 w-full max-w-md mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-600/20 to-yellow-600/20 px-6 py-4 border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-amber-400 font-black text-base uppercase tracking-wide">Buy Shares</h2>
                <p className="text-gray-500 text-xs font-mono">{listing.pin}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-lg text-gray-500 hover:text-red-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-4">
            {!receipt ? (
              <>
                {/* Parcel info */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
                  <p className="text-white font-bold text-sm">{parcelName}</p>
                  {address && <p className="text-gray-400 text-xs">{address}</p>}
                  {currentZoning && (
                    <div className="flex gap-2 text-xs mt-1">
                      <span className="text-gray-500">{currentZoning}</span>
                      <span className="text-amber-500">→</span>
                      <span className="text-gray-300">{proposedZoning}</span>
                    </div>
                  )}
                </div>

                {/* Listing stats */}
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Available" value={`${maxShares}`} unit="shares" />
                  <Stat label="Price" value={pricePerShare} unit={`${tokenSymbol}/share`} />
                  <Stat label="Owner" value={listing.owner_wallet?.split('.')[2] ? `0.0.${listing.owner_wallet.split('.')[2]}` : (listing.owner_wallet ? `${listing.owner_wallet.slice(0, 6)}...${listing.owner_wallet.slice(-4)}` : '—')} unit="" mono />
                </div>

                {/* Buyer wallet */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-gray-500 mb-1">Buying as</p>
                  <p className="text-emerald-400 font-mono text-sm">{wallet}</p>
                </div>

                {/* Amount input */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Number of Shares to Buy
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={maxShares}
                    placeholder={`1 – ${maxShares}`}
                    value={sharesAmount}
                    onChange={(e) => { setSharesAmount(e.target.value); setError(''); }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-gray-600"
                  />
                </div>

                {/* Cost preview */}
                {shares > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-gray-400 text-sm">{shares} shares × {pricePerShare} {tokenSymbol}</span>
                    <span className="text-amber-400 font-black text-lg">{totalCost} {tokenSymbol}</span>
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
                  onClick={handleBuy}
                  disabled={loading || !shares}
                  className="w-full bg-gradient-to-r from-amber-600/30 to-yellow-600/30 hover:from-amber-600/50 hover:to-yellow-600/50 border border-amber-500/40 text-amber-400 font-black py-3 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing on {isDurham ? 'ADI Chain' : 'Hedera'}...
                      </span>
                    : `Buy ${shares || 0} Shares for ${totalCost} ${tokenSymbol}`
                  }
                </button>
              </>
            ) : (
              /* Receipt */
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-black text-lg">Purchase Complete!</h3>
                  <p className="text-gray-400 text-sm mt-1">Shares transferred on {isDurham ? 'ADI Chain' : 'Hedera'} testnet.</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2 text-left">
                  <Row label="Shares Bought" value={String(isDurham ? receipt.purchase?.sharesPurchased : receipt.shares_purchased)} />
                  <Row label="Total Paid" value={`${isDurham ? receipt.purchase?.totalPaid : receipt.total_paid_hbar} ${tokenSymbol}`} />
                  <Row label="Seller Received" value={`${isDurham ? receipt.purchase?.sellerReceives : receipt.seller_received_hbar} ${tokenSymbol}`} />
                  <Row label="Platform Fee" value={`${isDurham ? receipt.purchase?.platformFee : receipt.platform_fee_hbar} ${tokenSymbol}`} />
                  <Row label="TX" value={isDurham ? receipt.purchase?.txHash : receipt.tx_hash} mono />
                </div>
                {receipt.explorer_url && (
                  <a
                    href={receipt.explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-sm py-2.5 rounded-xl hover:bg-amber-500/30 transition-all text-center"
                  >
                    View on Hashscan ↗
                  </a>
                )}
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

function Stat({ label, value, unit, mono }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-white font-black text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      {unit && <p className="text-gray-600 text-xs">{unit}</p>}
    </div>
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
