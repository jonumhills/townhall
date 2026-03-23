import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { useHederaWallet } from '../hooks/useHederaWallet';
import { useX402Payment } from '../hooks/useX402Payment';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Message bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-sm">ℏ</span>
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-gray-900 text-white rounded-br-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
        }`}
      >
        {msg.content}
        {msg.tools_used?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {msg.tools_used.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-100">
                🔧 {t.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-sm">👤</span>
        </div>
      )}
    </motion.div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
        <span className="text-sm">ℏ</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-400"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Payment status banner ─────────────────────────────────────────────────────
function PaymentBanner({ isPaying, error, lastTxHash }) {
  if (isPaying) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="px-4 py-2.5 bg-purple-50 border-b border-purple-200 flex items-center gap-2 text-sm text-purple-700"
      >
        <motion.div
          className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
        Sending 1 HBAR payment via MetaMask…
      </motion.div>
    );
  }
  if (error) {
    return (
      <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-sm text-red-600">
        ⚠️ {error}
      </div>
    );
  }
  if (lastTxHash) {
    return (
      <div className="px-4 py-2 bg-green-50 border-b border-green-200 text-xs text-green-700">
        ✓ Payment confirmed&nbsp;·&nbsp;
        <a
          href={`https://hashscan.io/testnet/transaction/${lastTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {lastTxHash.slice(0, 12)}…
        </a>
      </div>
    );
  }
  return null;
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AIChat() {
  const { account, shortAddress, connect, disconnect, isConnecting, error: walletError } = useHederaWallet();
  const { payAndPost, isPaying, paymentError, lastTxHash } = useX402Payment();

  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [countyId,  setCountyId]  = useState('raleigh_nc');

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || isPaying) return;
    if (!account) {
      alert('Connect your Hedera wallet first — 1 HBAR is charged per message.');
      return;
    }

    // Append user message immediately
    const userMsg = { role: 'user', content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    // Build conversation history for backend (last 10 turns)
    const history = nextHistory
      .slice(-11, -1)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await payAndPost(
        `${API_BASE}/api/chat`,
        { message: text, county_id: countyId, conversation_history: history },
      );

      setMessages(prev => [
        ...prev,
        {
          role:       'assistant',
          content:    res.data.reply,
          tools_used: res.data.tools_used || [],
        },
      ]);
    } catch (err) {
      const errText = err.response?.data?.detail || err.message || 'Request failed';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${errText}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />

      <div className="flex-1 container mx-auto max-w-3xl px-4 py-8 flex flex-col">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <span className="text-purple-600">ℏ</span> Townhall Intelligence
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                AI-powered zoning &amp; petition analysis · <strong>1 HBAR per message</strong> · paid on Hedera Testnet
              </p>
            </div>

            {/* Wallet + county */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              {account ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-mono">
                    <span>ℏ</span> {shortAddress}
                  </span>
                  <button
                    onClick={disconnect}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connect}
                  disabled={isConnecting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  <span>ℏ</span>
                  {isConnecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
              )}
              {walletError && <p className="text-xs text-red-500">{walletError}</p>}

              {/* County selector */}
              <select
                value={countyId}
                onChange={e => setCountyId(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white"
              >
                <option value="raleigh_nc">Raleigh, NC</option>
                <option value="durham_nc">Durham, NC</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chat container */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">

          {/* Payment status banner */}
          <PaymentBanner isPaying={isPaying} error={paymentError} lastTxHash={lastTxHash} />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[400px] max-h-[560px]">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="text-4xl mb-3">🏛️</div>
                <h3 className="text-lg font-bold text-gray-700 mb-2">Ask about Raleigh zoning</h3>
                <p className="text-sm text-gray-400 max-w-sm mb-6">
                  Search petitions, check approval rates, find developers, analyze trends.
                  Each message costs <strong>1 HBAR</strong> — paid automatically via MetaMask.
                </p>
                <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                  {[
                    'What are the latest approved rezonings?',
                    'Show me all NX-3 petitions this year',
                    'What\'s the approval rate for mixed-use proposals?',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
            </AnimatePresence>

            {(loading || isPaying) && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-4">
            <div className="flex gap-3 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={account ? 'Ask about zoning petitions… (Enter to send)' : 'Connect your wallet to start chatting'}
                disabled={!account || loading || isPaying}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50 disabled:bg-gray-50"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || !account || loading || isPaying}
                className="px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {isPaying ? '⏳' : loading ? '…' : '↑'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              1 HBAR charged per message · Hedera Testnet · Powered by Claude
            </p>
          </div>
        </div>

      </div>

      <Footer />
    </div>
  );
}
