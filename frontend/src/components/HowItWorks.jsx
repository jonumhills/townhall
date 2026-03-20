import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const roles = [
  {
    key: 'developer',
    label: 'Developer',
    icon: '🏗️',
    color: '#ff4400',
    border: 'rgba(255,68,0,0.3)',
    bg: 'rgba(255,68,0,0.08)',
    cta: 'Tokenize Your Property',
    path: '/marketplace',
    steps: [
      {
        number: '01',
        title: 'Upload Your Deed',
        description: 'Submit your property deed, parcel ID, and zoning documents through the platform.',
      },
      {
        number: '02',
        title: 'Oracle Verification',
        description: 'Zoning data is hashed into a Merkle tree and the root is anchored on Hedera consensus.',
      },
      {
        number: '03',
        title: 'Mint NFT Deed',
        description: 'Your property becomes a Hedera HTS Non-Fungible Token — immutable, on-chain ownership.',
      },
      {
        number: '04',
        title: 'Fractionalise & Raise',
        description: 'Set a share count and price. Sell fractional HTS tokens to investors and raise capital.',
      },
    ],
  },
  {
    key: 'investor',
    label: 'Investor / Public',
    icon: '📈',
    color: '#ff8800',
    border: 'rgba(255,136,0,0.3)',
    bg: 'rgba(255,136,0,0.08)',
    cta: 'Browse Properties',
    path: '/marketplace',
    steps: [
      {
        number: '01',
        title: 'Browse Listings',
        description: 'Explore oracle-verified properties. Filter by zoning score, location, price per share, and funding progress.',
      },
      {
        number: '02',
        title: 'Review Zoning Score',
        description: 'Check the algorithmic zoning score (0–100) and AI-generated risk summary before investing.',
      },
      {
        number: '03',
        title: 'Buy Shares with HBAR',
        description: 'Purchase fractional HTS tokens using HBAR via HashPack wallet. Instant settlement on Hedera.',
      },
      {
        number: '04',
        title: 'Hold or Trade',
        description: 'Track your portfolio value. List shares on the secondary market anytime to realise gains.',
      },
    ],
  },
  {
    key: 'lender',
    label: 'Lender',
    icon: '🏦',
    color: '#f87171',
    border: 'rgba(248,113,113,0.3)',
    bg: 'rgba(248,113,113,0.08)',
    cta: 'Open Lender Portal',
    path: '/lender',
    steps: [
      {
        number: '01',
        title: 'Search a Parcel',
        description: 'Look up any parcel by PIN, address, or click on the interactive map to start due diligence.',
      },
      {
        number: '02',
        title: 'Review Zoning Data',
        description: 'See the full zoning profile: classification, permitted uses, restrictions, and official document links.',
      },
      {
        number: '03',
        title: 'Verify Oracle Proof',
        description: 'Inspect the Merkle proof anchored on Hedera. Confirm the data is cryptographically unaltered.',
      },
      {
        number: '04',
        title: 'Make a Decision',
        description: 'Use the zoning score, AI risk summary, and on-chain audit trail to lend with confidence.',
      },
    ],
  },
];

function HowItWorks() {
  const [active, setActive] = useState('developer');
  const navigate = useNavigate();

  const current = roles.find((r) => r.key === active);

  return (
    <section id="how-it-works" className="py-28 bg-black relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-red-600/4 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 max-w-7xl relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm font-medium tracking-widest uppercase">How It Works</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Your Journey on{' '}
            <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">Townhall</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Three distinct paths. One unified platform. All verified on Hedera.
          </p>
        </motion.div>

        {/* Role tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="flex justify-center gap-3 mb-12"
        >
          {roles.map((role) => (
            <button
              key={role.key}
              onClick={() => setActive(role.key)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
              style={
                active === role.key
                  ? { background: role.bg, border: `1px solid ${role.border}`, color: role.color }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#9ca3af' }
              }
            >
              <span>{role.icon}</span>
              {role.label}
            </button>
          ))}
        </motion.div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              {current.steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                  className="relative rounded-2xl p-6"
                  style={{
                    background: `linear-gradient(135deg, ${current.bg} 0%, rgba(0,0,0,0.7) 100%)`,
                    border: `1px solid ${current.border}`,
                  }}
                >
                  {/* Connector line */}
                  {i < current.steps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 right-0 w-5 h-px translate-x-2.5"
                      style={{ background: current.border }} />
                  )}

                  <div className="text-4xl font-black mb-4 opacity-20" style={{ color: current.color }}>
                    {step.number}
                  </div>
                  <h3 className="text-white font-bold text-base mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex justify-center">
              <button
                onClick={() => navigate(current.path)}
                className="flex items-center gap-2 px-7 py-3 font-bold text-sm rounded-xl transition-all hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${current.color}, ${current.color}aa)`,
                  color: '#fff',
                  boxShadow: `0 6px 24px ${current.color}40`,
                }}
              >
                {current.cta}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
}

export default HowItWorks;
