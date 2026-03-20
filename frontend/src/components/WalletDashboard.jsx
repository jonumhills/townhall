import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hedera, durham } from '../services/api';

/**
 * WalletDashboard — slide-in panel showing everything linked to a wallet address.
 *
 * Sections:
 *   1. Summary stats (parcels owned, shares held, total value)
 *   2. My Parcels — from token_registry where owner_wallet = wallet
 *      • PIN, county, listing status, shares breakdown, share token
 *   3. My Share Holdings — from share_holdings where buyer_wallet = wallet
 *      • Parcel PIN, shares owned, price paid, tx hash
 *
 * Props:
 *   wallet            {string}   connected wallet (Hedera account ID or Ethereum address)
 *   onClose           {fn}
 *   onFocusParcel     {fn(pin, geometry)}  — zoom map to a specific parcel
 *   onHighlightOwned  {fn(pins[]|null)}    — highlight only owned parcels (null resets)
 *   serviceType       {string}  'hedera' or 'durham'
 */
export default function WalletDashboard({ wallet, onClose, onFocusParcel, onHighlightOwned, serviceType = 'hedera' }) {
  const [tab, setTab] = useState('parcels'); // 'parcels' | 'holdings'
  const [owned, setOwned] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showingOwned, setShowingOwned] = useState(false);

  const isDurham = serviceType === 'adi' || serviceType === 'durham';
  const service = isDurham ? durham : hedera;
  const tokenSymbol = isDurham ? 'ADI' : 'HBAR';
  const explorerBase = isDurham
    ? 'https://explorer.ab.testnet.adifoundation.ai'
    : 'https://hashscan.io/testnet';

  console.log('🎯 WalletDashboard serviceType:', serviceType, '| isDurham:', isDurham);

  useEffect(() => {
    if (!wallet) return;
    load();
  }, [wallet]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ownedRes, portfolioRes] = await Promise.all([
        service.getOwned(wallet),
        service.getPortfolio(wallet),
      ]);
      setOwned(ownedRes.owned || []);
      setPortfolio(portfolioRes.portfolio || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOwnedOnMap = () => {
    if (!onHighlightOwned) return;
    if (showingOwned) {
      onHighlightOwned(null); // reset
      setShowingOwned(false);
    } else {
      onHighlightOwned(owned); // pass full rows so MapView has geometry
      setShowingOwned(true);
    }
  };

  // Reset map highlight when dashboard closes
  const handleClose = () => {
    if (showingOwned && onHighlightOwned) onHighlightOwned(null);
    onClose();
  };

  // Summary numbers
  const totalOwnedParcels = owned.length;
  const totalSharesHeld = portfolio.reduce((s, h) => s + h.shares_owned, 0);
  const totalValue = portfolio.reduce((s, h) => {
    return s + (isDurham ? (h.price_paid_adi || 0) : (h.price_paid_hbar || 0));
  }, 0);
  const totalListedShares = owned.reduce((s, p) => s + (p.listed_shares || 0), 0);
  const totalSoldShares = owned.reduce((s, p) => s + (p.shares_sold || 0), 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Panel — slides in from right */}
        <motion.div
          initial={{ x: 480, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 480, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative z-10 h-full w-full max-w-md bg-black/97 border-l border-emerald-500/20 shadow-2xl shadow-emerald-500/10 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600/15 to-teal-600/15 px-5 py-4 border-b border-emerald-500/20 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-emerald-400 font-black text-sm uppercase tracking-wide">Wallet Dashboard</h2>
                  <p className="text-gray-500 font-mono text-xs">{wallet}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Show only my parcels on map toggle */}
                {onHighlightOwned && owned.length > 0 && (
                  <button
                    onClick={handleToggleOwnedOnMap}
                    title={showingOwned ? 'Reset map view' : 'Show only my parcels on map'}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      showingOwned
                        ? 'bg-emerald-500/30 border border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:border-emerald-500/30 hover:text-emerald-400'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    {showingOwned ? 'Reset Map' : 'My Parcels'}
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-red-500/20 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-2">
              <StatBadge label="Parcels" value={totalOwnedParcels} color="emerald" />
              <StatBadge label="Listed" value={totalListedShares} color="amber" />
              <StatBadge label="Sold" value={totalSoldShares} color="blue" />
              <StatBadge label="Bought" value={totalSharesHeld} color="purple" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 shrink-0">
            <TabBtn active={tab === 'parcels'} onClick={() => setTab('parcels')}>
              My Parcels
              {owned.length > 0 && <Badge>{owned.length}</Badge>}
            </TabBtn>
            <TabBtn active={tab === 'holdings'} onClick={() => setTab('holdings')}>
              Share Holdings
              {portfolio.length > 0 && <Badge>{portfolio.length}</Badge>}
            </TabBtn>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="flex items-center gap-3 text-gray-500">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">Loading wallet data…</span>
                </div>
              </div>
            ) : error ? (
              <div className="m-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>
            ) : tab === 'parcels' ? (
              <ParcelsTab owned={owned} onFocusParcel={onFocusParcel} tokenSymbol={tokenSymbol} explorerBase={explorerBase} />
            ) : (
              <HoldingsTab portfolio={portfolio} totalValue={totalValue} tokenSymbol={tokenSymbol} explorerBase={explorerBase} />
            )}
          </div>

          {/* Footer refresh */}
          <div className="border-t border-white/10 px-5 py-3 shrink-0">
            <button
              onClick={load}
              disabled={loading}
              className="w-full text-xs text-gray-500 hover:text-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Parcels owned tab ─────────────────────────────────────────────────────────
function ParcelsTab({ owned, onFocusParcel, tokenSymbol, explorerBase }) {
  if (owned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-6">
        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">No parcels claimed yet.</p>
        <p className="text-gray-600 text-xs mt-1">Claim a parcel on the map to get started.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {owned.map((parcel) => (
        <ParcelCard key={`${parcel.pin}-${parcel.county_id}`} parcel={parcel} onFocusParcel={onFocusParcel} tokenSymbol={tokenSymbol} explorerBase={explorerBase} />
      ))}
    </div>
  );
}

function ParcelCard({ parcel, onFocusParcel, tokenSymbol, explorerBase }) {
  const [expanded, setExpanded] = useState(false);
  const sharesSold = parcel.shares_sold || 0;
  const sharesListed = parcel.listed_shares || 0;
  const sharesAvail = parcel.available_shares || 0;

  const statusColor = parcel.listed
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-gray-400 bg-white/5 border-white/10';

  const location = parcel.metadata?.parcel?.address || parcel.metadata?.parcel?.location || '';

  // Get price based on blockchain type
  const pricePerShare = parcel.blockchain_type === 'adi'
    ? parcel.price_adi
    : parcel.price_hbar;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-start gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div className="min-w-0 text-left">
            <p className="text-white font-bold text-sm font-mono truncate">{parcel.pin}</p>
            {location && <p className="text-gray-500 text-xs truncate">{location}</p>}
            <p className="text-gray-600 text-xs">{parcel.county_id?.replace('_', ' ')}</p>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${statusColor}`}>
            {parcel.listed ? 'Listed' : 'Unlisted'}
          </span>
          {onFocusParcel && parcel.metadata?.geometry && (
            <button
              onClick={() => onFocusParcel(parcel.pin, parcel.metadata.geometry)}
              title="Locate on map"
              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg text-emerald-400 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-white/5 rounded transition-colors"
          >
            <svg className={`w-4 h-4 text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Shares breakdown bar */}
      <div className="px-4 pb-3">
        <ShareBar total={parcel.total_shares} listed={sharesListed} sold={sharesSold} available={sharesAvail} />
        <div className="grid grid-cols-3 gap-2 mt-2">
          <MiniStat label="Listed" value={sharesListed} color="amber" />
          <MiniStat label="Sold" value={sharesSold} color="blue" />
          <MiniStat label="Available" value={sharesAvail} color="emerald" />
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-4 py-3 space-y-2">
              <Row label="Price / Share" value={pricePerShare ? `${pricePerShare} ${tokenSymbol}` : '—'} />
              <Row label="Listed Shares" value={`${sharesListed} / ${parcel.total_shares}`} />
              {parcel.listed_at && <Row label="Listed At" value={new Date(parcel.listed_at).toLocaleDateString()} />}
              <Row label="NFT Token" value={parcel.nft_token_id} mono link={`${explorerBase}/token/${parcel.nft_token_id}`} />
              <Row label="Share Token" value={parcel.share_token_id} mono link={`${explorerBase}/token/${parcel.share_token_id}`} />
              <Row label="Minted" value={new Date(parcel.created_at).toLocaleDateString()} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Share holdings tab ────────────────────────────────────────────────────────
function HoldingsTab({ portfolio, totalValue, tokenSymbol, explorerBase }) {
  if (portfolio.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-6">
        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">No share holdings yet.</p>
        <p className="text-gray-600 text-xs mt-1">Buy shares from listed parcels on the map.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Total value */}
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-center justify-between">
        <span className="text-gray-400 text-sm">Total Invested</span>
        <span className="text-purple-400 font-black text-lg">{totalValue.toFixed(2)} {tokenSymbol}</span>
      </div>

      {portfolio.map((holding, i) => (
        <HoldingCard key={i} holding={holding} explorerBase={explorerBase} />
      ))}
    </div>
  );
}

function HoldingCard({ holding, explorerBase }) {
  // Get price based on blockchain type
  const pricePaid = holding.blockchain_type === 'adi'
    ? holding.price_paid_adi
    : holding.price_paid_hbar;
  const tokenSymbol = holding.blockchain_type === 'adi' ? 'ADI' : 'HBAR';

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-bold text-sm font-mono">{holding.pin}</p>
          <p className="text-gray-600 text-xs">{holding.county_id?.replace('_', ' ')}</p>
        </div>
        <div className="text-right">
          <p className="text-purple-400 font-black text-sm">{holding.shares_owned} shares</p>
          <p className="text-gray-500 text-xs">{pricePaid} {tokenSymbol} paid</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-600 text-xs">{new Date(holding.purchased_at).toLocaleDateString()}</span>
        {holding.share_token_id && (
          <a
            href={`${explorerBase}/token/${holding.share_token_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
          >
            View token ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── Small primitives ──────────────────────────────────────────────────────────
function ShareBar({ total, listed, sold, available }) {
  if (!total) return null;
  const listedPct = (listed / total) * 100;
  const soldPct = (sold / total) * 100;
  const availPct = (available / total) * 100;

  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex mt-1">
      <div className="h-full bg-blue-500" style={{ width: `${soldPct}%` }} title={`Sold: ${sold}`} />
      <div className="h-full bg-amber-400" style={{ width: `${listedPct}%` }} title={`Listed: ${listed}`} />
      <div className="h-full bg-emerald-500/50" style={{ width: `${availPct}%` }} title={`Available: ${available}`} />
    </div>
  );
}

function MiniStat({ label, value, color }) {
  const colors = {
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
  };
  return (
    <div className="text-center">
      <p className={`font-black text-sm ${colors[color]}`}>{value}</p>
      <p className="text-gray-600 text-xs">{label}</p>
    </div>
  );
}

function StatBadge({ label, value, color }) {
  const colors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
      <p className={`font-black text-base ${colors[color]}`}>{value}</p>
      <p className="text-gray-600 text-xs">{label}</p>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-colors border-b-2 ${
        active
          ? 'text-emerald-400 border-emerald-500'
          : 'text-gray-500 border-transparent hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ children }) {
  return (
    <span className="bg-white/10 text-gray-400 text-xs font-bold px-1.5 py-0.5 rounded-md">{children}</span>
  );
}

function Row({ label, value, mono, link }) {
  const content = mono
    ? <span className="font-mono text-xs break-all">{value || '—'}</span>
    : <span className="text-xs">{value || '—'}</span>;

  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-500 text-xs uppercase tracking-wider shrink-0">{label}</span>
      {link
        ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 text-right transition-colors">{content}</a>
        : <span className="text-white text-right">{content}</span>
      }
    </div>
  );
}
