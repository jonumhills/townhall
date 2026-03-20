import { Link } from 'react-router-dom';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black border-t border-white/5 text-white pt-16 pb-8">
      <div className="container mx-auto px-6 max-w-7xl">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(255,68,0,0.3), rgba(255,120,0,0.15))', border: '1px solid rgba(255,68,0,0.3)' }}>
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <span className="text-white font-black text-lg tracking-wider">TOWNHALL</span>
                <span className="block text-gray-500 text-xs">RWA Platform on Hedera</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm mb-5">
              A trustless real estate tokenization platform. Property deeds become HTS NFTs. Zoning data is oracle-verified on Hedera. Anyone can invest with HBAR.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xs font-bold text-gray-400">Hedera Future Origin Hackathon</span>
              <span className="text-xs font-black text-white">2026</span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-widest mb-5">Platform</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><Link to="/marketplace" className="hover:text-white transition-colors">Marketplace</Link></li>
              <li><Link to="/lender" className="hover:text-white transition-colors">Lender Portal</Link></li>
              <li><Link to="/chat" className="hover:text-white transition-colors">AI Chat Assistant</Link></li>
              <li><Link to="/map" className="hover:text-white transition-colors">Property Map</Link></li>
            </ul>
          </div>

          {/* Technology */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-widest mb-5">Technology</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>ℏ Hedera Token Service</li>
              <li>🔗 Merkle Zoning Oracle</li>
              <li>🤖 x402 AI Micropayments</li>
              <li>📍 Mapbox GL Property Maps</li>
              <li>⚡ FastAPI + React</li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            &copy; {currentYear} Townhall. Built for the Hedera Future Origin Hackathon — DeFi &amp; Tokenization Track.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Powered by</span>
            <span className="text-white font-black">ℏ HEDERA</span>
          </div>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
