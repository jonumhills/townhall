import { motion } from 'framer-motion';

const pillars = [
  {
    icon: '🔷',
    title: 'HTS Tokenization',
    desc: 'Property deeds as NFTs. Fractional shares as fungible tokens. Native Hedera Token Service.',
  },
  {
    icon: '🔗',
    title: 'Zoning Oracle',
    desc: 'Off-chain zoning data anchored as Merkle roots on Hedera consensus. Cryptographically verified.',
  },
  {
    icon: 'ℏ',
    title: 'HBAR Payments',
    desc: 'Buy and sell property shares instantly with HBAR. Low fees, high throughput.',
  },
  {
    icon: '🤖',
    title: 'x402 AI Queries',
    desc: 'Pay-per-query AI assistant. Each query costs micro-HBAR — true metered intelligence.',
  },
  {
    icon: '⏱️',
    title: 'Consensus Timestamps',
    desc: 'Every verification, transfer, and state change timestamped on Hedera for full auditability.',
  },
];

function HederaStrip() {
  return (
    <section className="py-16 relative overflow-hidden"
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-white/[0.01] to-black pointer-events-none" />

      <div className="container mx-auto px-6 max-w-7xl relative z-10">

        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">
            Powered by Hedera — Built for the Future of Real Assets
          </span>
        </motion.div>

        {/* Pillars */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              viewport={{ once: true }}
              className="rounded-2xl p-5 text-center"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-2xl mb-3">{p.icon}</div>
              <div className="text-white font-bold text-sm mb-2">{p.title}</div>
              <p className="text-gray-500 text-xs leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default HederaStrip;
