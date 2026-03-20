import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();

  const navLinks = [
    { label: 'Marketplace', path: '/marketplace' },
    { label: 'Lender Portal', path: '/lender' },
    { label: 'Maps', path: '/chat' },
    { label: 'Docs', path: '/docs' },
  ];

  return (
    <nav className="bg-black/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
      <div className="container mx-auto px-8 py-4">
        <div className="flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(255,68,0,0.3), rgba(255,120,0,0.15))', border: '1px solid rgba(255,68,0,0.3)' }}>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <span className="text-white font-black text-xl tracking-wider">TOWNHALL</span>
              <span className="block text-gray-500 text-xs tracking-wide">RWA Platform</span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Hedera badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xs font-bold text-gray-400">Powered by</span>
              <span className="text-xs font-black text-white tracking-wider">ℏ HEDERA</span>
            </div>

            <Link
              to="/marketplace"
              className="px-5 py-2.5 text-white font-bold text-sm rounded-xl transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #ff4400, #ff8800)',
                boxShadow: '0 4px 20px rgba(255,68,0,0.35)',
              }}
            >
              Launch App
            </Link>
          </div>

        </div>
      </div>
    </nav>
  );
}

export default Navigation;
