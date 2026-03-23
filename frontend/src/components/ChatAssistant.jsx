import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { useX402Payment } from '../hooks/useX402Payment';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const ChatAssistant = ({ onPetitionsHighlight, onPetitionClick, countyId = 'raleigh_nc' }) => {
  const { account } = useWallet();
  const { payAndPost, isPaying } = useX402Payment();

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Townhall Intelligence Assistant. I can help you explore zoning data, find development opportunities, and analyze rezoning trends. How can I assist you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAlertSubscription = async (agentReply) => {
    const alertMatch = agentReply.match(/ALERT_SUBSCRIPTION_REQUEST:\s*email=([^,]+),\s*address=(.+?),\s*radius=(\d+)/);

    if (alertMatch) {
      const [_, email, address, radius] = alertMatch;
      try {
        const response = await fetch(`${API_BASE}/alerts/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            address: address.trim(),
            radius_miles: parseInt(radius)
          })
        });
        return response.ok;
      } catch (error) {
        console.error('Alert subscription failed:', error);
        return false;
      }
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isPaying) return;

    if (!account) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Please connect your Hedera wallet first — 1 HBAR is charged per message.',
      }]);
      return;
    }

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setAgentStatus('Sending payment…');

    try {
      const res = await payAndPost(
        `${API_BASE}/chat`,
        { message: userMessage, county_id: countyId, conversation_history: conversationHistory },
      );

      setAgentStatus('Generating response...');
      const data = res.data;

      const agentReply = data.reply || 'I\'m having trouble processing that request.';

      await handleAlertSubscription(agentReply);

      const cleanReply = agentReply.replace(/\*\*ALERT_SUBSCRIPTION_REQUEST:.*?\*\*/g, '').trim();

      setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }]);

      // Update conversation history for multi-turn context
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: cleanReply },
      ]);

      // Highlight parcels green on map if callback provided
      const petitionIds = data.petition_ids || [];
      const parcelFeatures = data.parcel_features || [];
      if ((petitionIds.length > 0 || parcelFeatures.length > 0) && onPetitionsHighlight) {
        onPetitionsHighlight(petitionIds, parcelFeatures);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const msg = error.response?.data?.detail || error.message || 'Request failed';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${msg}`,
      }]);
    } finally {
      setAgentStatus('');
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickQuery = (query) => {
    setInput(query);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, 0);
  };

  const parseTableRows = (lines) => {
    return lines
      .filter(l => !/^\s*\|[-:\s|]+\|\s*$/.test(l)) // drop separator rows like |---|---|
      .map(l =>
        l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
      );
  };

  const formatMessageContent = (content) => {
    if (!content) return '';

    const lines = content.split('\n');
    const result = [];
    let numberedItems = [];
    let bulletItems = [];
    let tableLines = [];

    const flushNumbered = (key) => {
      if (numberedItems.length === 0) return;
      result.push(
        <ol key={`ol-${key}`} className="mt-2 mb-3 space-y-2">
          {numberedItems.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-[10px] font-black text-red-400 mt-0.5">{item.num}</span>
              <span className="text-gray-200 text-sm leading-relaxed">{formatInlineText(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      numberedItems = [];
    };

    const flushBullets = (key) => {
      if (bulletItems.length === 0) return;
      result.push(
        <ul key={`ul-${key}`} className="mt-2 mb-3 space-y-1.5">
          {bulletItems.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 mt-2" />
              <span className="text-gray-200 text-sm leading-relaxed">{formatInlineText(item)}</span>
            </li>
          ))}
        </ul>
      );
      bulletItems = [];
    };

    const flushTable = (key) => {
      if (tableLines.length === 0) return;
      const rows = parseTableRows(tableLines);
      if (rows.length === 0) { tableLines = []; return; }
      const headers = rows[0];
      const dataRows = rows.slice(1);
      result.push(
        <div key={`tbl-${key}`} className="mt-3 mb-3 overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,68,0,0.15)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(255,68,0,0.1)', borderBottom: '1px solid rgba(255,68,0,0.2)' }}>
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-bold text-red-300 uppercase tracking-wider whitespace-nowrap">
                    {formatInlineText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: ri < dataRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-gray-300 leading-snug">
                      {cell ? formatInlineText(cell) : <span className="text-gray-600">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableLines = [];
    };

    const flushAll = (key) => { flushNumbered(key); flushBullets(key); flushTable(key); };

    lines.forEach((line, index) => {
      // Table row detection: starts and ends with |
      if (/^\s*\|.+\|\s*$/.test(line)) {
        flushNumbered(index); flushBullets(index);
        tableLines.push(line);
        return;
      }

      // If we were in a table but this line isn't, flush it
      if (tableLines.length > 0) flushTable(index);

      if (line.trim() === '') {
        flushNumbered(index); flushBullets(index);
        result.push(<div key={`sp-${index}`} className="h-1" />);
        return;
      }

      // Horizontal rule ---
      if (/^-{3,}$/.test(line.trim())) {
        flushAll(index);
        result.push(<hr key={index} className="my-3 border-red-500/15" />);
        return;
      }

      // H3+ heading (### or ####)
      const h3Match = line.match(/^#{3,}\s+(.+)$/);
      if (h3Match) {
        flushAll(index);
        result.push(
          <div key={index} className="font-bold text-orange-300 text-xs uppercase tracking-widest mt-3 mb-1">
            {formatInlineText(h3Match[1])}
          </div>
        );
        return;
      }

      // H1/H2 heading (# or ##)
      const h1Match = line.match(/^#{1,2}\s+(.+)$/);
      if (h1Match) {
        flushAll(index);
        result.push(
          <div key={index} className="flex items-center gap-2 mt-3 mb-1.5">
            <div className="w-1 h-4 rounded-full bg-red-500 flex-shrink-0" />
            <span className="font-black text-white text-sm tracking-wide uppercase">{formatInlineText(h1Match[1])}</span>
          </div>
        );
        return;
      }

      // Bold standalone line as sub-header: **text** or **text:**
      const boldHeadMatch = line.match(/^\*\*([^*]{3,})\*\*:?\s*$/);
      if (boldHeadMatch) {
        flushAll(index);
        result.push(
          <div key={index} className="font-bold text-orange-300 text-xs uppercase tracking-widest mt-3 mb-1">
            {formatInlineText(boldHeadMatch[1])}
          </div>
        );
        return;
      }

      // Numbered list
      const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
      if (numberedMatch) {
        flushBullets(index); flushTable(index);
        numberedItems.push({ num: numberedMatch[1], text: numberedMatch[2] });
        return;
      }

      // Bullet list
      const bulletMatch = line.match(/^[\-\*\•]\s+(.+)$/);
      if (bulletMatch) {
        flushNumbered(index); flushTable(index);
        bulletItems.push(bulletMatch[1]);
        return;
      }

      // Plain paragraph
      flushAll(index);
      result.push(
        <p key={index} className="text-gray-200 text-sm leading-relaxed">
          {formatInlineText(line)}
        </p>
      );
    });

    flushAll('end');
    return result;
  };

  const formatInlineText = (text) => {
    const parts = [];
    let lastIndex = 0;
    const isPetitionNum = (s) => /^[A-Z]-\d{1,4}-\d{4}$/.test(s);
    // Match bold **text** OR bare petition numbers like Z-29-2023
    const regex = /(\*\*(.+?)\*\*)|([A-Z]-\d{1,4}-\d{4})/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Determine petition number — could be bare or wrapped in **...**
      const petNum = match[3] || (isPetitionNum(match[2]) ? match[2] : null);
      if (petNum) {
        // Petition number — clickable map badge
        parts.push(
          <button
            key={match.index}
            onClick={() => onPetitionClick && onPetitionClick(petNum)}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md font-mono text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95"
            style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.45)',
              color: '#4ade80',
            }}
            title={`Show ${petNum} on map`}
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {petNum}
          </button>
        );
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const quickQueries = [
    "Show me the top 5 developers",
    "What's the approval rate?",
    "Find commercial opportunities",
    "Show me recent N1 to N2 conversions"
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-red-500/20">
        <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          TOWNHALL AI
        </h2>
        <p className="text-xs text-gray-500">Powered by Claude + Supabase</p>
      </div>

      {/* Quick Queries */}
      <div className="p-4 border-b border-red-500/20">
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Quick queries:</p>
        <div className="flex flex-wrap gap-2">
          {quickQueries.map((query, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleQuickQuery(query)}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-xs text-gray-300 transition-all"
            >
              {query}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'flex-col'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 px-1">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-500/40">
                    <span className="text-white text-xs">🤖</span>
                  </div>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Townhall AI</span>
                </div>
              )}
              <div
                className={`rounded-2xl ${
                  msg.role === 'user'
                    ? 'max-w-[82%] px-4 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-500/30'
                    : 'w-full px-5 py-4 text-gray-200'
                }`}
                style={msg.role === 'assistant' ? {
                  background: 'rgba(20,20,20,0.8)',
                  border: '1px solid rgba(255,68,0,0.12)',
                } : {}}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="text-sm leading-relaxed space-y-0.5">
                    {formatMessageContent(msg.content)}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm">👤</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 px-1">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-500/40">
                <span className="text-white text-xs">🤖</span>
              </div>
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Townhall AI</span>
            </div>
            <div className="w-full rounded-2xl px-5 py-4" style={{ background: 'rgba(20,20,20,0.8)', border: '1px solid rgba(255,68,0,0.12)' }}>
              {agentStatus && (
                <div className="text-xs text-orange-400/80 mb-3 font-medium">{agentStatus}</div>
              )}
              <div className="flex gap-1.5">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay }}
                    className="w-2 h-2 bg-red-500 rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-red-500/20">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isPaying}
            placeholder={account ? 'Ask about zoning, developers, or trends…' : 'Connect wallet to chat (1 HBAR/message)'}

            rows={1}
            className="flex-1 bg-white/5 border border-red-500/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 resize-none overflow-hidden"
          />
          <button
            type="submit"
            disabled={isLoading || isPaying || !input.trim()}
            className="w-12 h-12 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-red-500/50"
          >
            {isPaying ? '💸' : isLoading ? '⏳' : '📤'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatAssistant;
