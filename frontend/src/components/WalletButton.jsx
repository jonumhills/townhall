import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * WalletButton — Multi-chain wallet connection (MVP: manual account ID/address entry)
 *
 * Props:
 *   wallet       {string|null}  — currently connected account ID or address
 *   onConnect    {fn(accountId)} — called with validated account ID/address
 *   onDisconnect {fn}
 *   chainType    {string}        — 'hedera' or 'adi' (default: 'hedera')
 */
export default function WalletButton({ wallet, onConnect, onDisconnect, onOpenDashboard, chainType = 'hedera' }) {
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const isHedera = chainType === 'hedera';
  const chainName = isHedera ? 'Hedera' : 'ADI Chain';
  const networkName = isHedera ? 'Hedera Testnet' : 'ADI Testnet';
  const placeholder = isHedera ? '0.0.12345' : '0x1234...5678';
  const portalUrl = isHedera ? 'https://portal.hedera.com' : 'https://faucet.ab.testnet.adifoundation.ai';
  const portalName = isHedera ? 'portal.hedera.com' : 'ADI testnet faucet';

  const validate = (val) => {
    if (isHedera) {
      return /^0\.0\.\d+$/.test(val.trim());
    } else {
      return /^0x[a-fA-F0-9]{40}$/.test(val.trim());
    }
  };

  const handleConnect = () => {
    const trimmed = input.trim();
    if (!validate(trimmed)) {
      setError(isHedera ? 'Enter a valid Hedera account ID (e.g. 0.0.12345)' : 'Enter a valid Ethereum address (e.g. 0x1234...)');
      return;
    }

    // Add 0.8s delay before connecting
    setTimeout(() => {
      onConnect(trimmed);
      setShowModal(false);
      setInput('');
      setError('');
    }, 800);
  };

  const handleDisconnect = () => {
    // Add 0.8s delay before disconnecting
    setTimeout(() => {
      onDisconnect();
      setInput('');
      setError('');
    }, 800);
  };

  // ── Connected state — compact badge (click to open dashboard) ───────────
  if (wallet) {
    return (
      <div className="flex items-center gap-1 bg-black/80 backdrop-blur-xl rounded-2xl border border-emerald-500/30 overflow-hidden">
        <button
          onClick={onOpenDashboard}
          className="flex items-center gap-2 px-4 py-2.5 hover:bg-emerald-500/10 transition-colors"
          title="View wallet dashboard"
        >
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-400 font-mono text-sm font-bold">
            {isHedera ? wallet : `${wallet.slice(0, 6)}...${wallet.slice(-4)}`}
          </span>
        </button>
        <button
          onClick={handleDisconnect}
          className="px-2 py-2.5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors border-l border-emerald-500/20"
          title="Disconnect"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // ── Disconnected state ────────────────────────────────────────────────────
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 bg-gradient-to-r from-amber-600/30 to-yellow-600/30 hover:from-amber-600/50 hover:to-yellow-600/50 border border-amber-500/40 text-amber-400 font-black px-4 py-2.5 rounded-2xl transition-all backdrop-blur-xl"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Connect Wallet
      </button>

      {/* ── Full-screen connect modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowModal(false); setError(''); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className="relative z-10 w-full max-w-sm mx-4 bg-black/95 border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-600/20 to-yellow-600/20 px-6 py-5 border-b border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
                    {isHedera ? (
                      // Hedera H logo
                      <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v3h4V8h2v8h-2v-3h-4v3z"/>
                      </svg>
                    ) : (
                      // Generic wallet icon for ADI Chain
                      <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-amber-400 font-black text-base uppercase tracking-wide">Connect Wallet</h2>
                    <p className="text-gray-500 text-xs">{networkName}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowModal(false); setError(''); }}
                  className="p-2 hover:bg-red-500/20 rounded-xl text-gray-500 hover:text-red-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Info card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Enter your <span className="text-amber-400 font-bold">{networkName}</span> {isHedera ? 'account ID' : 'wallet address'} to claim parcels and trade shares on Townhall.
                  </p>
                  <p className="text-gray-600 text-xs">
                    Get a free testnet account at{' '}
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-500 hover:text-amber-400 underline"
                    >
                      {portalName}
                    </a>
                  </p>
                </div>

                {/* Account ID input */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    {isHedera ? 'Hedera Account ID' : 'Wallet Address'}
                  </label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none placeholder-gray-600 transition-colors"
                  />
                  {error && (
                    <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </p>
                  )}
                </div>

                {/* Connect button */}
                <button
                  onClick={handleConnect}
                  disabled={!input.trim()}
                  className="w-full bg-gradient-to-r from-amber-600/40 to-yellow-600/40 hover:from-amber-600/60 hover:to-yellow-600/60 border border-amber-500/50 text-amber-400 font-black py-3 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
                >
                  Connect to Townhall
                </button>

                <p className="text-center text-gray-600 text-xs">
                  MVP: Direct account ID entry. Hashpack integration coming soon.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
