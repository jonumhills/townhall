import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const products = [
  {
    icon: '🏪',
    title: 'Marketplace',
    subtitle: 'Buy & sell fractional shares',
    description: 'Browse oracle-verified property listings. Purchase fractional HTS share tokens with HBAR. Trade on the secondary market anytime.',
    tag: 'DeFi',
    tagColor: '#ff8800',
    tagBg: 'rgba(255,136,0,0.15)',
    gradientFrom: 'rgba(255,136,0,0.1)',
    border: 'rgba(255,136,0,0.2)',
    path: '/marketplace',
    cta: 'Open Marketplace',
    highlights: ['HTS Fungible Tokens', 'HBAR Payments', 'Secondary Trading'],
  },
  {
    icon: '🏦',
    title: 'Lender Portal',
    subtitle: 'Oracle-verified due diligence',
    description: 'Verify deed NFTs, inspect zoning proofs anchored on Hedera, and check the AI-powered zoning score before committing funds.',
    tag: 'Verification',
    tagColor: '#f87171',
    tagBg: 'rgba(248,113,113,0.15)',
    gradientFrom: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
    path: '/lender',
    cta: 'Open Lender Portal',
    highlights: ['Merkle Proof Verification', 'Zoning Score (0–100)', 'On-chain Audit Trail'],
  },
  {
    icon: '🤖',
    title: 'AI Chat Assistant',
    subtitle: 'x402 micropayments on Hedera',
    description: 'Ask anything about a parcel in plain English. Each query is metered in micro-HBAR via x402 payments. Registered on the HOL Agent Registry via HCS-10.',
    tag: 'AI Agents',
    tagColor: '#a78bfa',
    tagBg: 'rgba(167,139,250,0.15)',
    gradientFrom: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.2)',
    path: '/chat',
    cta: 'Try AI Chat',
    highlights: ['x402 Micropayments', 'HCS-10 Agent Registry', 'Natural Language Queries'],
  },
  {
    icon: '🔮',
    title: 'Zoning Oracle',
    subtitle: 'Cryptographic proof of zoning data',
    description: 'Off-chain county zoning records are hashed into Merkle trees. The root is anchored on Hedera consensus — making every data point independently verifiable.',
    tag: 'Oracle',
    tagColor: '#34d399',
    tagBg: 'rgba(52,211,153,0.15)',
    gradientFrom: 'rgba(52,211,153,0.06)',
    border: 'rgba(52,211,153,0.2)',
    path: '/lender',
    cta: 'View Oracle Data',
    highlights: ['Merkle Tree Proofs', 'Hedera Consensus', 'Tamper-proof Records'],
  },
];

function Features() {
  const navigate = useNavigate();

  return (
    <section id="features" className="py-28 bg-black relative overflow-hidden">
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-orange-600/4 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 max-w-7xl relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm font-medium tracking-widest uppercase">Platform</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Four Pillars of{' '}
            <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">Townhall</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Each component is independently powerful. Together, they form a complete trustless real estate investment stack.
          </p>
        </motion.div>

        {/* Product cards — 2x2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {products.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              onClick={() => navigate(p.path)}
              className="relative rounded-3xl p-8 cursor-pointer group transition-all duration-300 hover:scale-[1.01] hover:-translate-y-1"
              style={{
                background: `linear-gradient(135deg, ${p.gradientFrom} 0%, rgba(0,0,0,0.85) 100%)`,
                border: `1px solid ${p.border}`,
                boxShadow: '0 4px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <div className="flex items-start justify-between mb-5">
                <div className="text-4xl">{p.icon}</div>
                <span
                  className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                  style={{ background: p.tagBg, color: p.tagColor, border: `1px solid ${p.border}` }}
                >
                  {p.tag}
                </span>
              </div>

              <h3 className="text-2xl font-black text-white mb-1">{p.title}</h3>
              <p className="text-sm font-bold mb-3" style={{ color: p.tagColor }}>{p.subtitle}</p>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">{p.description}</p>

              {/* Highlight pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {p.highlights.map((h) => (
                  <span
                    key={h}
                    className="px-3 py-1 rounded-full text-xs font-medium text-gray-300"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-sm font-bold group-hover:gap-3 transition-all" style={{ color: p.tagColor }}>
                {p.cta}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="rounded-3xl p-12 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,68,0,0.1) 0%, rgba(0,0,0,0.9) 50%, rgba(255,100,0,0.07) 100%)',
            border: '1px solid rgba(255,68,0,0.18)',
            boxShadow: '0 4px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,68,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,68,0,0.015)_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="relative z-10">
            <div className="text-4xl mb-4">ℏ</div>
            <h3 className="text-3xl md:text-4xl font-black text-white mb-3">
              Built on Hedera. Trusted by Design.
            </h3>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              HTS tokenization · Merkle oracle proofs · HBAR payments · x402 AI · HOL Agent Registry
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => navigate('/marketplace')}
                className="inline-flex items-center gap-2 px-8 py-4 text-white font-black text-base rounded-2xl transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #ff4400, #ff8800)', boxShadow: '0 8px 30px rgba(255,68,0,0.4)' }}
              >
                Explore Marketplace
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <button
                onClick={() => navigate('/lender')}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/8 border border-white/15 text-white font-bold text-base rounded-2xl hover:bg-white/15 transition-all"
              >
                Lender Portal
              </button>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}

export default Features;
