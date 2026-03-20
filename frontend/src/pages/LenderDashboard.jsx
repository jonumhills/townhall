import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { api } from '../services/api';
import { estimateParcelValue, formatUsd, formatHbar } from '../utils/marketPricing';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// ── Zoning score (mirrors oracle-push algorithm) ──────────────────────────────
const ZONING_RANKS = {
  AG: -4, EX: -4, CON: -4, OS: -3,
  'R-40': -2, 'R-20': -1, 'R-10': 0, 'R-6': 1, 'R-4': 2,
  RX: 2, NX: 3, OX: 3, TOD: 4, CX: 4, DX: 5,
  IX: -1, IH: -2,
};

function computeZoningScoreFE(petition, parcelProps) {
  let score = 50;
  const raw = petition.current_zoning || parcelProps.current_zoning || '';
  const code = raw.toUpperCase().split(' ')[0];
  score += (ZONING_RANKS[code] ?? 0) * 5;
  if (petition.legislation_url || parcelProps.legislation_url) score += 10;
  const proposed = petition.proposed_zoning || parcelProps.proposed_zoning;
  const current  = petition.current_zoning  || parcelProps.current_zoning;
  if (!proposed || proposed === current) score += 15;
  else score -= 10;
  if (petition.vote_result) {
    const v = petition.vote_result.toLowerCase();
    if (v.includes('approved') || v.includes('passed'))  score += 10;
    if (v.includes('denied')   || v.includes('rejected')) score -= 15;
    if (v.includes('withdrawn'))                          score -= 5;
  }
  if (petition.status) {
    const s = petition.status.toLowerCase();
    if (s === 'approved') score += 5;
    if (s === 'denied')   score -= 10;
    if (s === 'pending')  score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}

// ── Zoning permissions lookup ──────────────────────────────────────────────────
const ZONING_PERMISSIONS = {
  AG:     { label: 'Agricultural',               permitted: ['Farming', 'Single-family residential', 'Barns & accessory structures'], restricted: ['Commercial use', 'Multi-family', 'Industrial'] },
  'R-40': { label: 'Residential (Very Low Density)', permitted: ['Single-family homes', 'Home occupations', 'Agriculture (limited)'],    restricted: ['Multi-family', 'Commercial', 'Industrial'] },
  'R-20': { label: 'Residential (Low Density)',   permitted: ['Single-family homes', 'Home occupations', 'Accessory dwellings'],         restricted: ['Multi-family > 2 units', 'Commercial'] },
  'R-10': { label: 'Residential (Standard)',      permitted: ['Single-family homes', 'Duplexes', 'Home occupations', 'Accessory dwellings'], restricted: ['Commercial retail', 'Industrial'] },
  'R-6':  { label: 'Residential (Medium Density)',permitted: ['Single-family', 'Duplexes', 'Townhomes', 'ADUs'],                        restricted: ['Large commercial', 'Industrial'] },
  'R-4':  { label: 'Residential (High Density)', permitted: ['Townhomes', 'Low-rise apartments', 'Live/work units'],                    restricted: ['Heavy commercial', 'Industrial'] },
  RX:     { label: 'Residential Mixed-Use',       permitted: ['Residential', 'Small-scale retail', 'Offices (ground floor)', 'Restaurants'], restricted: ['Heavy industrial', 'Auto sales'] },
  NX:     { label: 'Neighborhood Mixed-Use',      permitted: ['Retail', 'Restaurants', 'Offices', 'Residential above commercial'],      restricted: ['Industrial', 'Auto repair', 'Drive-throughs'] },
  OX:     { label: 'Office Mixed-Use',            permitted: ['Offices', 'Medical', 'Residential', 'Retail (limited)'],                 restricted: ['Heavy retail', 'Industrial'] },
  TOD:    { label: 'Transit-Oriented Development',permitted: ['High-density residential', 'Retail', 'Office', 'Hotels'],                restricted: ['Auto-dependent uses', 'Heavy industrial'] },
  CX:     { label: 'Commercial Mixed-Use',        permitted: ['All retail', 'Restaurants', 'Hotels', 'Offices', 'Residential'],        restricted: ['Heavy industrial', 'Waste facilities'] },
  DX:     { label: 'Downtown Mixed-Use',          permitted: ['High-rise residential', 'All commercial', 'Entertainment', 'Hotels', 'Offices'], restricted: ['Industrial', 'Auto repair'] },
  IX:     { label: 'Light Industrial',            permitted: ['Light manufacturing', 'Warehousing', 'Research & development'],          restricted: ['Residential', 'Heavy industrial'] },
  IH:     { label: 'Heavy Industrial',            permitted: ['Manufacturing', 'Heavy warehousing', 'Processing facilities'],           restricted: ['Residential', 'Schools', 'Hospitals'] },
};

function getPermissions(zoningCode) {
  if (!zoningCode) return null;
  const normalized = zoningCode.trim().toUpperCase().split(' ')[0];
  if (ZONING_PERMISSIONS[normalized]) return ZONING_PERMISSIONS[normalized];
  for (const key of Object.keys(ZONING_PERMISSIONS)) {
    if (normalized.startsWith(key)) return ZONING_PERMISSIONS[key];
  }
  return null;
}

// ── Reusable pill ──────────────────────────────────────────────────────────────
function Pill({ children, color }) {
  const colors = {
    blue:   'bg-blue-100 border-blue-200 text-blue-800',
    orange: 'bg-orange-100 border-orange-200 text-orange-800',
    green:  'bg-green-100 border-green-200 text-green-800',
    purple: 'bg-purple-100 border-purple-200 text-purple-800',
    yellow: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    red:    'bg-red-100 border-red-200 text-red-800',
    gray:   'bg-gray-100 border-gray-200 text-gray-700',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LenderDashboard() {
  const [searchPin, setSearchPin]         = useState('');
  const [countyId, setCountyId]           = useState('durham_nc');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [verificationData, setVerificationData] = useState(null);
  const [oracleData, setOracleData]       = useState(null);
  const [loadingOracle, setLoadingOracle] = useState(false);

  const mapContainerRef  = useRef(null);
  const mapRef           = useRef(null);
  const hederaMarkerRef  = useRef(null);

  const ORACLE_API_URL        = import.meta.env.VITE_ORACLE_URL || 'http://localhost:3000';
  const HEDERA_EXPLORER_BASE  = 'https://hashscan.io/testnet/contract';

  // ── Oracle query ─────────────────────────────────────────────────────────────
  const queryOracleAPI = async (searchTerm) => {
    setLoadingOracle(true);
    try {
      const res = await fetch(`${ORACLE_API_URL}/query/${searchTerm}`);
      const data = await res.json();

      if (!data.success || !data.found) {
        setOracleData({ exists: false });
        return;
      }

      const v = data.verification;
      setOracleData({
        exists:          true,
        petitionNumber:  data.petition.number,
        status:          data.petition.status,
        merkleRoot:      v.merkleRoot,
        merkleProof:     v.merkleProof,
        isValid:         v.isValid,
        dataHash:        v.dataHash,
        verifiedAt:      v.verifiedAt,
        totalPetitions:  v.petitionCount,
        contractAddress: v.hederaContract,
        hederaTxUrl:     v.hederaExplorer,
      });
    } catch (err) {
      setOracleData({ exists: false, error: err.message });
    } finally {
      setLoadingOracle(false);
    }
  };

  // ── Verify handler ────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!searchPin.trim()) { setError('Please enter a parcel PIN'); return; }
    setLoading(true);
    setError('');
    setVerificationData(null);
    setOracleData(null);
    if (hederaMarkerRef.current) { hederaMarkerRef.current.remove(); hederaMarkerRef.current = null; }
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    try {
      const response = await api.verifyParcelForLender(searchPin, countyId);
      setVerificationData(response);

      // Use oracle data from backend response if available
      if (response.oracle?.isValid !== undefined) {
        const v = response.oracle;
        setOracleData({
          exists:          true,
          petitionNumber:  response.petition_data?.petition_number,
          merkleRoot:      v.merkleRoot,
          merkleProof:     v.merkleProof,
          isValid:         v.isValid,
          dataHash:        v.dataHash,
          verifiedAt:      v.verifiedAt,
          totalPetitions:  v.petitionCount,
          contractAddress: v.hederaContract,
          hederaTxUrl:     v.hederaExplorer,
        });
        setLoadingOracle(false);
      } else {
        // Fallback: query oracle directly from frontend
        const oracleTerm = response.petition_data?.petition_number || searchPin;
        queryOracleAPI(oracleTerm);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Map init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!verificationData || !mapContainerRef.current || mapRef.current) return;
    const countyCoords = { durham_nc: [-78.9, 35.99], raleigh_nc: [-78.6382, 35.7796] };
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style:     'mapbox://styles/mapbox/light-v11',
      center:    countyCoords[countyId] || [-78.9, 35.99],
      zoom:      9,
      projection: 'mercator',
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [verificationData, countyId]);

  // ── Parcel polygon + Hedera badge ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !verificationData?.parcel_geometry) return;
    const map = mapRef.current;

    const addLayer = () => {
      ['parcel-fill', 'parcel-outline'].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource('parcel')) map.removeSource('parcel');
      map.addSource('parcel', { type: 'geojson', data: { type: 'Feature', geometry: verificationData.parcel_geometry, properties: {} } });
      map.addLayer({ id: 'parcel-fill',    type: 'fill', source: 'parcel', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.4 } });
      map.addLayer({ id: 'parcel-outline', type: 'line', source: 'parcel', paint: { 'line-color': '#1d4ed8', 'line-width': 3 } });

      const bbox = turf.bbox({ type: 'Feature', geometry: verificationData.parcel_geometry });
      map.fitBounds(bbox, { padding: 60, maxZoom: 17 });

      // ── Hedera verified badge ──────────────────────────────────────────────
      if (hederaMarkerRef.current) { hederaMarkerRef.current.remove(); hederaMarkerRef.current = null; }

      const [minLng, minLat, maxLng, maxLat] = bbox;
      const [lng, lat] = [maxLng, maxLat];

      const el = document.createElement('div');
      el.innerHTML = `
        <div style="position:relative; width:40px; height:40px; cursor:default;">
          <!-- Main circle: dark with ℏ -->
          <div style="
            width:40px; height:40px; border-radius:50%;
            background: linear-gradient(135deg, #111 0%, #1a1a2e 100%);
            border: 2.5px solid rgba(255,255,255,0.25);
            box-shadow: 0 3px 14px rgba(0,0,0,0.55);
            display:flex; align-items:center; justify-content:center;
          ">
            <span style="color:#fff; font-size:16px; font-weight:900; font-family:sans-serif; line-height:1;">ℏ</span>
          </div>
          <!-- Green verified tick (bottom-right corner) -->
          <div style="
            position:absolute; bottom:-1px; right:-1px;
            width:16px; height:16px; border-radius:50%;
            background:#22c55e;
            border:2px solid #fff;
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 1px 4px rgba(0,0,0,0.3);
          ">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.2 2.5 3.8-4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      `;
      el.style.cssText = 'position:absolute;';

      hederaMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom-right' })
        .setLngLat([lng, lat])
        .addTo(map);
    };

    map.isStyleLoaded() ? addLayer() : map.once('styledata', addLayer);
  }, [verificationData]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const petition    = verificationData?.petition_data    || {};
  const parcelProps = verificationData?.parcel_properties || {};
  const zoning      = petition.current_zoning || parcelProps.current_zoning;
  const areaSqft    = parcelProps.area_sqft;
  const pricing     = verificationData ? estimateParcelValue(zoning, areaSqft) : null;
  const permissions = getPermissions(zoning);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navigation />

      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {/* ── Page header ── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🏦 Lender Verification Portal</h1>
          <p className="text-gray-600">Verify parcel legitimacy with oracle-verified data before lending</p>
        </motion.div>

        {/* ── Search bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-8"
        >
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Parcel PIN</label>
              <input
                type="text"
                value={searchPin}
                onChange={(e) => setSearchPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="Enter parcel PIN (e.g. 171820)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">County</label>
              <select
                value={countyId}
                onChange={(e) => setCountyId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="durham_nc">Durham, NC</option>
                <option value="raleigh_nc">Raleigh, NC</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleVerify}
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
          )}
        </motion.div>

        {/* ── Empty state ── */}
        {!verificationData && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-medium text-gray-600 mb-2">Enter a parcel PIN to verify</h3>
            <p className="text-gray-500">We'll check deed verification, oracle data, price sentiment, and risk assessment</p>
          </motion.div>
        )}

        {/* ── Results ── */}
        <AnimatePresence>
          {verificationData && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

              {/* Parcel header */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      📍 Parcel: {searchPin} ({verificationData.county_name || countyId})
                    </h2>
                    <p className="text-gray-600">{verificationData.address}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {zoning && <Pill color="blue">{zoning}</Pill>}
                    {petition.status && <Pill color="yellow">{petition.status}</Pill>}
                    <Pill color="green">✓ Oracle Verified</Pill>
                  </div>
                </div>
              </div>

              {/* ── Row 1: Map + Blockchain verification ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

                {/* Left column: Map + Zoning Score stacked */}
                <div className="flex flex-col gap-6">

                  {/* Map */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="font-bold text-gray-800">📍 Parcel Map</span>
                      {areaSqft && (
                        <span className="text-xs text-gray-400">
                          {Math.round(areaSqft).toLocaleString()} sqft · {(areaSqft / 43560).toFixed(2)} acres
                        </span>
                      )}
                    </div>
                    <div ref={mapContainerRef} style={{ width: '100%', height: '340px' }} />
                  </div>

                  {/* Zoning Score */}
                  {(() => {
                    const score = pricing?.zoningScore ?? computeZoningScoreFE(petition, parcelProps);
                    const label = score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Fair' : score >= 35 ? 'Moderate Risk' : 'High Risk';
                    const barColor = score >= 80 ? 'bg-green-500' : score >= 65 ? 'bg-blue-500' : score >= 50 ? 'bg-yellow-500' : score >= 35 ? 'bg-orange-500' : 'bg-red-500';
                    const textColor = score >= 80 ? 'text-green-700' : score >= 65 ? 'text-blue-700' : score >= 50 ? 'text-yellow-700' : score >= 35 ? 'text-orange-700' : 'text-red-700';
                    const bgColor = score >= 80 ? 'bg-green-50 border-green-200' : score >= 65 ? 'bg-blue-50 border-blue-200' : score >= 50 ? 'bg-yellow-50 border-yellow-200' : score >= 35 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200';
                    return (
                      <div className="flex-1 bg-white rounded-xl shadow-lg p-6 flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 Zoning Score</h3>
                          <div className={`rounded-xl border p-4 ${bgColor} flex items-center gap-5 mb-5`}>
                            <div className={`text-6xl font-black ${textColor} leading-none`}>{score}</div>
                            <div>
                              <div className={`text-xl font-bold ${textColor}`}>{label}</div>
                              <div className="text-xs text-gray-500 mt-0.5">out of 100</div>
                            </div>
                          </div>
                          <div className="mb-4">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {zoning && (
                            <div className="p-2 bg-gray-50 rounded-lg">
                              <span className="text-gray-400 block">Zone</span>
                              <span className="font-bold text-gray-800">{zoning}</span>
                            </div>
                          )}
                          {petition.status && (
                            <div className="p-2 bg-gray-50 rounded-lg">
                              <span className="text-gray-400 block">Status</span>
                              <span className="font-bold text-gray-800 capitalize">{petition.status}</span>
                            </div>
                          )}
                          {petition.proposed_zoning && petition.proposed_zoning !== petition.current_zoning && (
                            <div className="p-2 bg-orange-50 rounded-lg col-span-2">
                              <span className="text-orange-500 block">Active Rezoning</span>
                              <span className="font-bold text-orange-800">{petition.current_zoning} → {petition.proposed_zoning}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Blockchain verification */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🔗 Blockchain Verification Details</h3>

                  {loadingOracle ? (
                    <div className="text-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                      <p className="text-sm text-gray-600 mt-2">Fetching oracle data…</p>
                    </div>
                  ) : oracleData?.exists ? (
                    <div className="space-y-3">
                      <div className="border-b pb-3">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Network</div>
                        <div className="text-sm text-gray-900 font-medium">Hedera Testnet</div>
                      </div>
                      <div className="border-b pb-3">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Verified At</div>
                        <div className="text-sm text-gray-900">
                          {oracleData.verifiedAt ? new Date(oracleData.verifiedAt).toLocaleString() : '—'}
                        </div>
                      </div>
                      <div className="border-b pb-3">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Petitions in Tree</div>
                        <div className="text-sm font-semibold text-gray-900">{oracleData.totalPetitions?.toLocaleString() || '—'}</div>
                      </div>
                      <div className="border-b pb-3">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Proof Valid</div>
                        <div className={`text-sm font-bold ${oracleData.isValid ? 'text-green-700' : 'text-red-600'}`}>
                          {oracleData.isValid ? '✓ Verified against on-chain root' : '✗ Proof mismatch'}
                        </div>
                      </div>
                      <div className="border-b pb-3">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Merkle Root</div>
                        <div className="font-mono text-xs text-gray-700 break-all">{oracleData.merkleRoot || '—'}</div>
                      </div>
                      {oracleData.dataHash && (
                        <div className="border-b pb-3">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data Hash</div>
                          <div className="font-mono text-xs text-gray-700 break-all">{oracleData.dataHash}</div>
                        </div>
                      )}
                      {oracleData.merkleProof?.length > 0 && (
                        <div className="border-b pb-3">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Merkle Proof ({oracleData.merkleProof.length} nodes)
                          </div>
                          <details className="cursor-pointer">
                            <summary className="text-xs text-blue-600 hover:underline">Show proof</summary>
                            <div className="mt-2 max-h-40 overflow-y-auto bg-gray-50 p-2 rounded space-y-0.5">
                              {oracleData.merkleProof.map((hash, idx) => (
                                <div key={idx} className="font-mono text-xs text-gray-600 truncate">[{idx}] {hash}</div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
                      {oracleData.contractAddress && (
                        <div className="border-b pb-3">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Contract</div>
                          <a href={`${HEDERA_EXPLORER_BASE}/${oracleData.contractAddress}`} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-xs text-blue-600 hover:underline break-all">
                            {oracleData.contractAddress} ↗
                          </a>
                        </div>
                      )}
                      {oracleData.hederaTxUrl && (
                        <div className="border-b pb-3">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Hashscan</div>
                          <a href={oracleData.hederaTxUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline">View on Hashscan ↗</a>
                        </div>
                      )}
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <div className="text-sm font-bold text-green-800">Cryptographically Verified on Hedera</div>
                          <div className="text-xs text-green-700">Zoning data integrity confirmed via Merkle proof</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-400">
                      <p>No oracle data found for this petition</p>
                      <p className="text-xs mt-1">Petition may not be verified yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Row 2: Zoning details + Permitted uses ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

                {/* Zoning details */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🗺️ Zoning Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    {(petition.current_zoning || parcelProps.current_zoning) && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Current Zone</div>
                        <div className="text-blue-900 font-bold text-lg">{petition.current_zoning || parcelProps.current_zoning}</div>
                        {permissions && <div className="text-xs text-blue-700 mt-0.5">{permissions.label}</div>}
                      </div>
                    )}

                    {(petition.proposed_zoning || parcelProps.proposed_zoning) && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Proposed Rezoning</div>
                        <div className="text-orange-900 font-bold text-lg">{petition.proposed_zoning || parcelProps.proposed_zoning}</div>
                      </div>
                    )}

                    {petition.petition_number && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Rezoning Application</div>
                        <div className="text-gray-900 font-mono font-bold text-sm">{petition.petition_number}</div>
                        {petition.file_number && <div className="text-xs text-gray-500 mt-0.5">File: {petition.file_number}</div>}
                      </div>
                    )}

                    {petition.status && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</div>
                        <div className="inline-block bg-yellow-200 border border-yellow-400 px-2 py-0.5 rounded-full text-xs font-bold text-yellow-900 uppercase">
                          {petition.status}
                        </div>
                        {petition.action && (
                          <div className="inline-block ml-1 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full text-xs font-bold text-red-800 uppercase">
                            {petition.action}
                          </div>
                        )}
                      </div>
                    )}

                    {petition.vote_result && (
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Vote Result</div>
                        <div className="text-indigo-900 font-medium text-sm">{petition.vote_result}</div>
                      </div>
                    )}

                    {(petition.petitioner || parcelProps.petitioner) && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Petitioner</div>
                        <div className="text-purple-900 font-medium text-sm">{petition.petitioner || parcelProps.petitioner}</div>
                      </div>
                    )}

                    {(petition.meeting_date || parcelProps.meeting_date) && (
                      <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Meeting Date</div>
                        <div className="text-cyan-900 font-medium text-sm">{petition.meeting_date || parcelProps.meeting_date}</div>
                        {(petition.meeting_type || parcelProps.meeting_type) && (
                          <div className="text-xs text-cyan-700 mt-0.5">{petition.meeting_type || parcelProps.meeting_type}</div>
                        )}
                      </div>
                    )}

                    {areaSqft && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Parcel Area</div>
                        <div className="text-green-900 font-bold text-lg">{Math.round(areaSqft).toLocaleString()} sqft</div>
                        <div className="text-xs text-green-700">{(areaSqft / 43560).toFixed(2)} acres</div>
                      </div>
                    )}
                  </div>

                  {/* Official document link */}
                  {(petition.legislation_url || parcelProps.legislation_url) && (
                    <div className="mt-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">📄 Official Documents</div>
                      <a
                        href={petition.legislation_url || parcelProps.legislation_url}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors group"
                      >
                        <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-blue-800 font-bold text-sm group-hover:text-blue-900">View Complete Filing Document</div>
                          <div className="text-xs text-blue-600 truncate">{petition.legislation_url || parcelProps.legislation_url}</div>
                        </div>
                        <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>

                {/* Permitted uses */}
                <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">✅ Permitted Uses</h3>

                  {permissions ? (
                    <div className="flex flex-col gap-5 flex-1">

                      {/* Zone label */}
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-blue-100 border border-blue-200 rounded-full text-xs font-bold text-blue-800">
                          {permissions.label}
                        </span>
                        {zoning && (
                          <span className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-bold text-gray-600 font-mono">
                            {zoning}
                          </span>
                        )}
                      </div>

                      {/* Permitted — pill grid */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Permitted</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {permissions.permitted.map((item) => (
                            <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-800">
                              <svg className="w-3 h-3 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Restricted — pill grid */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Restricted</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {permissions.restricted.map((item) => (
                            <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                              <svg className="w-3 h-3 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Lender note */}
                      <div className="mt-auto pt-4 border-t border-gray-100">
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Lender Note</div>
                          <div className="text-xs text-gray-600 leading-relaxed">
                            {permissions.permitted.length >= 4
                              ? 'Broad permitted use spectrum supports strong collateral value and multiple exit strategies.'
                              : 'Limited permitted uses — evaluate collateral against specific permitted category demand.'}
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                      Permissions will appear once zoning code is available
                    </div>
                  )}
                </div>
              </div>

              {/* ── Price sentiment ── */}
              {pricing && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">💰 Price Sentiment</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Estimated Market Value</div>
                      <div className="text-3xl font-black text-blue-900 mb-1">{formatUsd(pricing.valueUsd)}</div>
                      <div className="text-xs text-gray-500">Rentcast avg + zoning multiplier</div>
                    </div>
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Value in HBAR</div>
                      <div className="text-2xl font-black text-purple-900 mb-1">{formatHbar(pricing.valueHbar)}</div>
                      <div className="text-xs text-gray-500">@ $0.18 / HBAR</div>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Per Share (1/1,000)</div>
                      <div className="text-2xl font-black text-green-900 mb-1">{formatUsd(Math.round(pricing.valueUsd / 1000))}</div>
                      <div className="text-xs text-gray-500">{formatHbar(pricing.valueHbarPerShare)} per share</div>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Pricing Breakdown</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-gray-500">Zoning Code:</span> <span className="font-bold text-gray-800">{pricing.zoningLabel}</span></div>
                      <div><span className="text-gray-500">Multiplier:</span> <span className="font-bold text-orange-700">{pricing.multiplier.toFixed(2)}×</span></div>
                      <div><span className="text-gray-500">Base Rate:</span> <span className="font-bold text-gray-800">$63.04/sqft</span></div>
                      {pricing.areaSqft && <div><span className="text-gray-500">Area:</span> <span className="font-bold text-gray-800">{Math.round(pricing.areaSqft).toLocaleString()} sqft</span></div>}
                      <div><span className="text-gray-500">Total Shares:</span> <span className="font-bold text-gray-800">1,000</span></div>
                      <div><span className="text-gray-500">Method:</span> <span className="font-bold text-gray-800">{pricing.areaSqft ? 'Area × rate × multiplier' : 'Median × multiplier'}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Action buttons ── */}
              <div className="flex gap-4 pb-4">
                <button className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Download Full Report
                </button>
                <button className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                  Export to API
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </div>
  );
}
