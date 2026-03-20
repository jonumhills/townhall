import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ELASTIC_API_KEY = import.meta.env.VITE_ELASTIC_API_KEY || '';
const ELASTIC_AGENT_NAME = import.meta.env.VITE_ELASTIC_AGENT_NAME || 'townhall_city_analyst';

const ChatAssistant = ({ onPetitionsHighlight }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Townhall Intelligence Assistant. I can help you explore zoning data, find development opportunities, and analyze rezoning trends. How can I assist you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const extractPetitionIds = (text) => {
    const regex = /petition[#\s]*(\d{4}-\d{3})/gi;
    const matches = [...text.matchAll(regex)];
    return matches.map(m => m[1]);
  };

  const handleAlertSubscription = async (agentReply) => {
    console.log('[AlertSub] Raw agent reply:', agentReply);
    const alertMatch = agentReply.match(/ALERT_SUBSCRIPTION_REQUEST:\s*email=([^,]+),\s*address=(.+?),\s*radius=(\d+)/);
    console.log('[AlertSub] Regex match result:', alertMatch);

    if (alertMatch) {
      const [_, email, address, radius] = alertMatch;

      try {
        console.log('[AlertSub] Calling /api/alerts/subscribe with:', { email: email.trim(), address: address.trim(), radius_miles: parseInt(radius) });
        const response = await fetch('/api/alerts/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            address: address.trim(),
            radius_miles: parseInt(radius)
          })
        });

        console.log('[AlertSub] Response status:', response.status);
        if (!response.ok) {
          const errBody = await response.text();
          console.error('[AlertSub] Error body:', errBody);
          throw new Error(`Subscription failed: ${response.status}`);
        }

        return true;
      } catch (error) {
        console.error('Alert subscription failed:', error);
        return false;
      }
    }

    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      setAgentStatus('Calling Elastic agent...');
      await new Promise(resolve => setTimeout(resolve, 600));

      const requestUrl = '/elastic-proxy/api/agent_builder/converse';
      const requestBody = {
        input: userMessage,
        agent_id: ELASTIC_AGENT_NAME,
        ...(conversationId && { conversation_id: conversationId })
      };

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${ELASTIC_API_KEY}`,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent request failed: ${response.status} - ${errorText}`);
      }

      setAgentStatus('Processing results...');
      await new Promise(resolve => setTimeout(resolve, 200));

      const data = await response.json();

      setAgentStatus('Generating response...');
      await new Promise(resolve => setTimeout(resolve, 300));

      const agentReply = data.response?.message || data.output || data.content || data.message || 'I\'m having trouble processing that request.';

      await handleAlertSubscription(agentReply);

      const cleanReply = agentReply.replace(/\*\*ALERT_SUBSCRIPTION_REQUEST:.*?\*\*/g, '').trim();

      setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }]);

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      const petitionIds = extractPetitionIds(agentReply);

      if (petitionIds.length > 0 && onPetitionsHighlight) {
        onPetitionsHighlight(petitionIds);
      }

    } catch (error) {
      setAgentStatus('');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble connecting to the agent. Please try again in a moment.'
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

  const formatMessageContent = (content) => {
    if (!content) return '';

    const lines = content.split('\n');
    const formattedLines = [];

    lines.forEach((line, index) => {
      if (line.trim() === '') {
        formattedLines.push(<br key={`br-${index}`} />);
        return;
      }

      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        formattedLines.push(
          <div key={index} className="flex gap-2 my-1">
            <span className="text-red-400 font-bold">{numberedMatch[1]}.</span>
            <span>{formatInlineText(numberedMatch[2])}</span>
          </div>
        );
        return;
      }

      const bulletMatch = line.match(/^[\-\*\•]\s+(.+)$/);
      if (bulletMatch) {
        formattedLines.push(
          <div key={index} className="flex gap-2 my-1">
            <span className="text-red-400">•</span>
            <span>{formatInlineText(bulletMatch[1])}</span>
          </div>
        );
        return;
      }

      const headingMatch = line.match(/^#{1,3}\s+(.+)$/) || line.match(/^\*\*(.+)\*\*$/);
      if (headingMatch) {
        formattedLines.push(
          <div key={index} className="font-bold text-red-400 mt-2 mb-1">
            {formatInlineText(headingMatch[1])}
          </div>
        );
        return;
      }

      formattedLines.push(
        <div key={index}>
          {formatInlineText(line)}
        </div>
      );
    });

    return formattedLines;
  };

  const formatInlineText = (text) => {
    const parts = [];
    let lastIndex = 0;
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="text-white">{match[1]}</strong>);
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
        <p className="text-xs text-gray-500">Powered by Elasticsearch Agent Builder</p>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/50">
                  <span className="text-white text-sm">🤖</span>
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl p-4 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-500/30'
                    : 'bg-white/5 text-gray-300 border border-red-500/20'
                }`}
              >
                <div className="text-sm leading-relaxed">
                  {formatMessageContent(msg.content)}
                </div>
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
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/50">
              <span className="text-white text-sm">🤖</span>
            </div>
            <div className="bg-white/5 border border-red-500/20 rounded-2xl p-4">
              {agentStatus && (
                <div className="text-xs text-red-400 mb-2">{agentStatus}</div>
              )}
              <div className="flex gap-1">
                <motion.div
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                  className="w-2 h-2 bg-red-500 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  className="w-2 h-2 bg-red-500 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  className="w-2 h-2 bg-red-500 rounded-full"
                />
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
            disabled={isLoading}
            placeholder="Ask about zoning, developers, or trends..."
            rows={1}
            className="flex-1 bg-white/5 border border-red-500/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 resize-none overflow-hidden"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-12 h-12 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-red-500/50"
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatAssistant;
