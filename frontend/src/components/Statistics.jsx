import { motion } from 'framer-motion';

const statItems = [
  {
    value: '142',
    suffix: '+',
    label: 'Properties Tokenized',
    description: 'Deeds minted as HTS NFTs',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    gradientFrom: 'rgba(255,68,0,0.15)',
    border: 'rgba(255,68,0,0.2)',
    iconBg: 'rgba(255,68,0,0.15)',
    iconColor: '#ff6030',
  },
  {
    value: '$4.2M',
    suffix: '',
    label: 'Total Value Locked',
    description: 'In fractional share tokens',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    gradientFrom: 'rgba(255,136,0,0.15)',
    border: 'rgba(255,136,0,0.2)',
    iconBg: 'rgba(255,136,0,0.15)',
    iconColor: '#ff8800',
  },
  {
    value: '890',
    suffix: '+',
    label: 'Active Investors',
    description: 'Holding fractional shares',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    gradientFrom: 'rgba(220,38,38,0.12)',
    border: 'rgba(220,38,38,0.2)',
    iconBg: 'rgba(220,38,38,0.15)',
    iconColor: '#f87171',
  },
  {
    value: '3,600',
    suffix: '+',
    label: 'Zoning Proofs Verified',
    description: 'Merkle roots on Hedera',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    gradientFrom: 'rgba(255,150,0,0.12)',
    border: 'rgba(255,150,0,0.2)',
    iconBg: 'rgba(255,150,0,0.15)',
    iconColor: '#fbbf24',
  },
];

const metrics = [
  { value: '<3s', label: 'Hedera Finality' },
  { value: '$0.001', label: 'Avg Transaction Fee' },
  { value: '100%', label: 'On-chain Verified' },
];

function Statistics() {
  return (
    <section id="stats" className="py-28 bg-black relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-red-600/4 rounded-full blur-3xl pointer-events-none" />

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
            <span className="text-red-400 text-sm font-medium tracking-widest uppercase">Platform Stats</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            By The{' '}
            <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">Numbers</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Real assets, real transactions, real value — all settled on Hedera.
          </p>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative rounded-3xl p-7 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
              style={{
                background: `linear-gradient(135deg, ${item.gradientFrom} 0%, rgba(0,0,0,0.7) 100%)`,
                border: `1px solid ${item.border}`,
                boxShadow: '0 4px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <div className="relative z-10">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: item.iconBg, color: item.iconColor }}
                >
                  {item.icon}
                </div>
                <div className="text-4xl font-black text-white mb-1 tracking-tight">
                  {item.value}{item.suffix}
                </div>
                <div className="text-base font-semibold text-white/90 mb-1">{item.label}</div>
                <div className="text-sm text-gray-500">{item.description}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Hedera Metrics Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-5 rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,68,0,0.07) 0%, rgba(0,0,0,0.9) 50%, rgba(255,100,0,0.05) 100%)',
            border: '1px solid rgba(255,68,0,0.12)',
            boxShadow: '0 4px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5">
            {metrics.map((m, i) => (
              <div key={i} className="flex flex-col items-center justify-center py-10 px-6 text-center gap-2">
                <div className="text-4xl font-black bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                  {m.value}
                </div>
                <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">{m.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}

export default Statistics;
