import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const roles = [
  {
    label: 'Zoning Oracle',
    icon: '🔮',
    tagline: 'On-Chain Zoning History',
    description: 'Every rezoning petition, permit, and boundary change is hashed and anchored on Hedera — tamper-proof and independently verifiable.',
    cta: 'View Oracle Data',
    path: '/lender',
    color: '#34d399',
    border: 'rgba(52,211,153,0.3)',
    bg: 'rgba(52,211,153,0.08)',
  },
  {
    label: 'Zoning Score',
    icon: '🎯',
    tagline: 'Credit Score for Land',
    description: 'A 0–100 composite score factoring zoning classification, rezoning stability, documentation completeness, and search demand.',
    cta: 'Open Lender Portal',
    path: '/lender',
    color: '#f87171',
    border: 'rgba(248,113,113,0.3)',
    bg: 'rgba(248,113,113,0.08)',
  },
  {
    label: 'AI Agent',
    icon: '🤖',
    tagline: 'x402 Micropayments on Hedera',
    description: 'Ask any due diligence question in plain English. Each query is metered in micro-HBAR via x402 and answered by a Claude-powered HCS-10 agent.',
    cta: 'Try AI Chat',
    path: '/chat',
    color: '#a78bfa',
    border: 'rgba(167,139,250,0.3)',
    bg: 'rgba(167,139,250,0.08)',
  },
];

function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-10 pb-20">

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,68,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,68,0,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-red-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-orange-600/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10 max-w-6xl">

        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-gray-300 text-sm font-medium">Hedera Future Origin Hackathon 2026</span>
            <span className="px-2 py-0.5 text-xs font-black rounded-full text-orange-300"
              style={{ background: 'rgba(255,136,0,0.15)', border: '1px solid rgba(255,136,0,0.25)' }}>
              Due Diligence Layer
            </span>
          </div>
        </motion.div>

        {/* Main heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-center mb-6"
        >
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black leading-none mb-6">
            <span className="bg-gradient-to-r from-white via-red-100 to-orange-200 bg-clip-text text-transparent">
              Real Estate
            </span>
            <br />
            <span className="bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
              Due Diligence.
            </span>
            <br />
            <span className="text-white">
              Powered by{' '}
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">ℏ</span>
              <span className="bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent"> Hedera.</span>
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            A due diligence layer for real-world asset lenders. Zoning history on-chain, AI-powered risk analysis, and cryptographic proof — in seconds instead of days.
          </p>
        </motion.div>

        {/* Role cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 max-w-4xl mx-auto"
        >
          {roles.map((role) => (
            <motion.div
              key={role.label}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              onClick={() => navigate(role.path)}
              className="relative rounded-2xl p-6 cursor-pointer group"
              style={{ background: role.bg, border: `1px solid ${role.border}` }}
            >
              <div className="text-3xl mb-3">{role.icon}</div>
              <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: role.color }}>
                {role.label}
              </div>
              <div className="text-white font-bold text-base mb-2">{role.tagline}</div>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">{role.description}</p>
              <div className="flex items-center gap-2 text-sm font-bold group-hover:gap-3 transition-all" style={{ color: role.color }}>
                {role.cta}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center items-center"
        >
          <button
            onClick={() => navigate('/lender')}
            className="px-8 py-3.5 text-white font-bold text-base rounded-xl transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #ff4400, #ff8800)', boxShadow: '0 6px 24px rgba(255,68,0,0.4)' }}
          >
            Open Lender Portal
          </button>
          <button
            onClick={() => navigate('/docs')}
            className="px-8 py-3.5 text-gray-300 font-semibold text-base rounded-xl border border-white/10 hover:bg-white/5 transition-all"
          >
            Read the Docs
          </button>
        </motion.div>

      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-5 h-9 border-2 border-white/15 rounded-full flex justify-center pt-1.5"
        >
          <div className="w-1 h-1.5 bg-red-500 rounded-full" />
        </motion.div>
      </motion.div>

    </section>
  );
}

export default Hero;
