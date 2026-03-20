import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import MapView from './pages/MapView';
import AdminDashboard from './pages/AdminDashboard';
import MapsDurham from './pages/MapsDurham';
import AdminDurham from './pages/AdminDurham';
import LenderDashboard from './pages/LenderDashboard';
import Docs from './pages/Docs';
import RaleighMap from './pages/RaleighMap';
import './index.css';

// Placeholder pages for upcoming features
function ComingSoon({ title }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h1 className="text-3xl font-black text-white mb-2">{title}</h1>
        <p className="text-gray-400">Coming soon — check back shortly.</p>
        <a href="/" className="inline-block mt-6 px-6 py-3 rounded-xl text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #ff4400, #ff8800)' }}>
          Back to Home
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/marketplace" element={<ComingSoon title="Marketplace" />} />
        <Route path="/chat" element={<RaleighMap />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/mapsdurham" element={<MapsDurham />} />
        <Route path="/admindurham" element={<AdminDurham />} />
        <Route path="/lender" element={<LenderDashboard />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </Router>
  );
}

export default App;
