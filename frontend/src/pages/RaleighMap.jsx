import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { motion, AnimatePresence } from 'framer-motion';
import ChatAssistant from '../components/ChatAssistant';
import api from '../services/api';

const MAPBOX_TOKEN  = import.meta.env.VITE_MAPBOX_TOKEN;
const TILESET_ID    = 'manojsrinivasa.wake-county-parcels';
const SOURCE_LAYER  = 'parcels';
const API_BASE      = import.meta.env.VITE_API_BASE_URL || '/api';

mapboxgl.accessToken = MAPBOX_TOKEN;

const MAP_STYLES = {
  dark:      { name: 'Dark',      url: 'mapbox://styles/mapbox/dark-v11' },
  satellite: { name: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  streets:   { name: 'Streets',   url: 'mapbox://styles/mapbox/streets-v12' },
};

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

export default function RaleighMap() {
  const mapContainer = useRef(null);
  const map          = useRef(null);

  const [mapStyle, setMapStyle]             = useState('dark');
  const [showStyleMenu, setShowStyleMenu]   = useState(false);
  const [isChatOpen, setIsChatOpen]         = useState(false);
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [cardPos, setCardPos]               = useState({ x: 0, y: 0 });
  const [petitionCount, setPetitionCount]   = useState(0);

  // Search bar state
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError]   = useState('');

  // In-memory stores for fast lookup
  const petitionFeaturesRef  = useRef([]);   // all petition parcels loaded at startup
  const aiChatFeaturesRef    = useRef([]);   // last AI chat / search highlighted features

  // ── Map initialisation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style:     MAP_STYLES.dark.url,
      center:    [-78.85, 35.78],
      zoom:      11,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right',
    );

    map.current.on('load', async () => {
      // ── ArcGIS parcels — Mapbox vector tileset (434k parcels, instant) ──
      map.current.addSource('arcgis-parcels', {
        type: 'vector',
        url:  `mapbox://${TILESET_ID}`,
      });

      map.current.addLayer({
        id:           'arcgis-fill',
        type:         'fill',
        source:       'arcgis-parcels',
        'source-layer': SOURCE_LAYER,
        paint: {
          'fill-color':   '#0ea5e9',
          'fill-opacity': 0.18,
        },
      });

      map.current.addLayer({
        id:           'arcgis-outline',
        type:         'line',
        source:       'arcgis-parcels',
        'source-layer': SOURCE_LAYER,
        paint: {
          'line-color':   '#38bdf8',
          'line-width':   0.6,
          'line-opacity': 0.7,
        },
      });

      // ── Petition parcels — GeoJSON overlay (orange) ──
      map.current.addSource('petition-parcels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id:     'petition-fill',
        type:   'fill',
        source: 'petition-parcels',
        paint: {
          'fill-color':   '#f97316',
          'fill-opacity': 0.65,
        },
      });

      map.current.addLayer({
        id:     'petition-outline',
        type:   'line',
        source: 'petition-parcels',
        paint: {
          'line-color': '#fb923c',
          'line-width': 2,
        },
      });

      // ── Click handlers ──
      ['arcgis-fill', 'petition-fill'].forEach(layerId => {
        map.current.on('click', layerId, e => {
          const props = e.features[0].properties;
          setSelectedParcel({ ...props, _layer: layerId });
          setCardPos({ x: e.point.x, y: e.point.y });
        });
        map.current.on('mouseenter', layerId, () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', layerId, () => {
          map.current.getCanvas().style.cursor = '';
        });
      });

      map.current.on('click', e => {
        const hits = map.current.queryRenderedFeatures(e.point, {
          layers: ['arcgis-fill', 'petition-fill'],
        });
        if (hits.length === 0) setSelectedParcel(null);
      });

      // ── Load petition overlay ──
      try {
        const geojson = await api.getParcelsGeoJSON('raleigh_nc');
        const feats   = (geojson?.features || []).filter(
          f => f.geometry?.coordinates && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'),
        );
        setPetitionCount(feats.length);
        petitionFeaturesRef.current = feats;   // store for search lookup
        if (map.current.getSource('petition-parcels')) {
          map.current.getSource('petition-parcels').setData({ type: 'FeatureCollection', features: feats });
        }
      } catch (err) {
        console.error('Petition load failed:', err);
      }
    });

    return () => {
      // Don't destroy — keep map alive across re-renders
    };
  }, []);

  // ── Style switch ──────────────────────────────────────────────────────────
  const switchStyle = (styleKey) => {
    if (!map.current) return;
    setMapStyle(styleKey);
    setShowStyleMenu(false);

    const petitionData  = map.current.getSource('petition-parcels')?._data;

    map.current.setStyle(MAP_STYLES[styleKey].url);

    map.current.once('styledata', () => {
      if (!map.current.getSource('arcgis-parcels')) {
        map.current.addSource('arcgis-parcels', { type: 'vector', url: `mapbox://${TILESET_ID}` });
        map.current.addLayer({ id: 'arcgis-fill',    type: 'fill', source: 'arcgis-parcels', 'source-layer': SOURCE_LAYER, paint: { 'fill-color': '#0ea5e9', 'fill-opacity': 0.18 } });
        map.current.addLayer({ id: 'arcgis-outline', type: 'line', source: 'arcgis-parcels', 'source-layer': SOURCE_LAYER, paint: { 'line-color': '#38bdf8', 'line-width': 0.6, 'line-opacity': 0.7 } });
      }
      if (!map.current.getSource('petition-parcels')) {
        map.current.addSource('petition-parcels', { type: 'geojson', data: petitionData || { type: 'FeatureCollection', features: [] } });
        map.current.addLayer({ id: 'petition-fill',    type: 'fill', source: 'petition-parcels', paint: { 'fill-color': '#f97316', 'fill-opacity': 0.65 } });
        map.current.addLayer({ id: 'petition-outline', type: 'line', source: 'petition-parcels', paint: { 'line-color': '#fb923c', 'line-width': 2 } });
      }
      // Restore AI chat / search green overlay
      if (aiChatFeaturesRef.current.length > 0 && !map.current.getSource('ai-chat-parcels')) {
        map.current.addSource('ai-chat-parcels', { type: 'geojson', data: { type: 'FeatureCollection', features: aiChatFeaturesRef.current } });
        map.current.addLayer({ id: 'ai-chat-fill',    type: 'fill', source: 'ai-chat-parcels', paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.70 } });
        map.current.addLayer({ id: 'ai-chat-outline', type: 'line', source: 'ai-chat-parcels', paint: { 'line-color': '#4ade80', 'line-width': 2.5 } });
      }
    });
  };

  // ── Add/update green overlay for AI chat or search results ───────────────
  const _highlightGreen = useCallback((features) => {
    if (!map.current || !features.length) return;
    aiChatFeaturesRef.current = features;
    const fc = { type: 'FeatureCollection', features };
    if (!map.current.getSource('ai-chat-parcels')) {
      map.current.addSource('ai-chat-parcels', { type: 'geojson', data: fc });
      map.current.addLayer({ id: 'ai-chat-fill',    type: 'fill', source: 'ai-chat-parcels', paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.70 } });
      map.current.addLayer({ id: 'ai-chat-outline', type: 'line', source: 'ai-chat-parcels', paint: { 'line-color': '#4ade80', 'line-width': 2.5 } });
    } else {
      map.current.getSource('ai-chat-parcels').setData(fc);
    }
    // Fit map to highlighted features
    const bounds = new mapboxgl.LngLatBounds();
    features.forEach(f => {
      const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
      rings[0].forEach(c => bounds.extend(c));
    });
    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 120, maxZoom: 18, duration: 800 });
    }
  }, []);

  // ── Highlight petitions from AI chat ──────────────────────────────────────
  const handlePetitionsHighlight = useCallback((petitionIds, parcelFeatures = []) => {
    // If AI returned GeoJSON features, render them green
    if (parcelFeatures.length > 0) {
      _highlightGreen(parcelFeatures);
      return;
    }
    // Fallback: yellow tint on petition-parcels layer for matching IDs
    if (!map.current?.getSource('petition-parcels')) return;
    map.current.setPaintProperty('petition-fill', 'fill-color', [
      'case',
      ['in', ['get', 'petition_number'], ['literal', petitionIds]],
      '#facc15',
      '#f97316',
    ]);
  }, [_highlightGreen]);

  // ── Click on petition number in chat → zoom + green highlight ───────────
  const handlePetitionClick = useCallback(async (petitionNumber) => {
    const q = petitionNumber.toUpperCase();

    // 1. In-memory lookup
    const found = petitionFeaturesRef.current.filter(
      f => (f.properties?.petition_number || '').toUpperCase() === q,
    );
    if (found.length > 0) {
      _highlightGreen(found);
      return;
    }

    // 2. Backend fallback
    try {
      const res = await fetch(
        `${API_BASE}/counties/raleigh_nc/parcels?petition_number=${encodeURIComponent(q)}`,
      );
      if (res.ok) {
        const data = await res.json();
        const feats = (data.features || []).filter(f => f.geometry?.coordinates);
        if (feats.length > 0) _highlightGreen(feats);
      }
    } catch (err) {
      console.error('Petition click lookup failed:', err);
    }
  }, [_highlightGreen]);

  // ── Search bar: petition number → zoom + green highlight ─────────────────
  const handlePetitionSearch = useCallback(async (e) => {
    e.preventDefault();
    const q = searchQuery.trim().toUpperCase();
    if (!q) return;
    setSearchError('');
    setSearchLoading(true);

    // 1. In-memory lookup from petition parcels loaded at startup
    const found = petitionFeaturesRef.current.filter(
      f => (f.properties?.petition_number || '').toUpperCase() === q,
    );
    if (found.length > 0) {
      _highlightGreen(found);
      setSearchLoading(false);
      return;
    }

    // 2. Backend fallback — ask for parcel features via parcels API
    try {
      const res = await fetch(
        `${API_BASE}/counties/raleigh_nc/parcels?petition_number=${encodeURIComponent(q)}`,
      );
      if (res.ok) {
        const data = await res.json();
        const feats = (data.features || []).filter(
          f => f.geometry?.coordinates,
        );
        if (feats.length > 0) {
          _highlightGreen(feats);
        } else {
          setSearchError(`No parcels found for ${q}`);
        }
      } else {
        setSearchError(`Petition ${q} not found`);
      }
    } catch {
      setSearchError('Search failed — check connection');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, _highlightGreen]);

  const isPetition = selectedParcel?._layer === 'petition-fill';

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex">

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div
        ref={mapContainer}
        className="flex-1 h-full transition-all duration-300"
        style={{ marginLeft: isChatOpen ? '480px' : '0', width: isChatOpen ? 'calc(100% - 480px)' : '100%' }}
      />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-5 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>

        {/* Logo / title */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(255,68,0,.35),rgba(255,120,0,.15))', border: '1px solid rgba(255,68,0,.3)' }}>
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <span className="text-white font-black text-base tracking-wider">Raleigh, NC</span>
            <span className="block text-gray-500 text-[10px] tracking-wide">Wake County · All Parcels</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Legend badges */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', color: '#38bdf8' }}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#0ea5e9' }} />
            ArcGIS Parcels · 434k
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)', color: '#fb923c' }}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#f97316' }} />
            Petitions · {petitionCount}
          </div>
        </div>

        {/* Petition search */}
        <form onSubmit={handlePetitionSearch} className="flex items-center gap-1">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
              placeholder="Z-29-2023"
              className="w-32 md:w-44 pl-3 pr-2 py-1.5 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all"
              style={{ background: 'rgba(255,255,255,0.07)', border: searchError ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)' }}
            />
            {searchError && (
              <div className="absolute top-full mt-1 left-0 text-[10px] text-red-400 whitespace-nowrap bg-black/80 px-2 py-1 rounded z-50">
                {searchError}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={searchLoading || !searchQuery.trim()}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-40"
            style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            {searchLoading ? '…' : '🔍'}
          </button>
        </form>

        {/* Style switcher */}
        <div className="relative">
          <button
            onClick={() => setShowStyleMenu(v => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {MAP_STYLES[mapStyle].name} ▾
          </button>
          <AnimatePresence>
            {showStyleMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden py-1 z-50"
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', minWidth: '140px' }}>
                {Object.entries(MAP_STYLES).map(([key, s]) => (
                  <button key={key} onClick={() => switchStyle(key)}
                    className={`block w-full text-left px-4 py-2 text-xs transition-colors ${mapStyle === key ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'}`}>
                    {s.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat toggle */}
        <button
          onClick={() => setIsChatOpen(v => !v)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={isChatOpen
            ? { background: 'linear-gradient(135deg,#ff4400,#ff8800)', color: '#fff', boxShadow: '0 4px 16px rgba(255,68,0,.4)' }
            : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" />
          </svg>
          AI Chat
        </button>

        {/* Back link */}
        <a href="/"
          className="text-gray-500 hover:text-gray-300 transition-colors text-xs">
          ← Home
        </a>
      </div>


      {/* ── Parcel info card ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedParcel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="absolute z-30 rounded-2xl p-4 w-72 pointer-events-auto"
            style={{
              left:   Math.min(cardPos.x + 12, window.innerWidth - 300),
              top:    Math.min(cardPos.y + 12, window.innerHeight - 280),
              background: 'rgba(10,10,10,0.92)',
              border: isPetition ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(14,165,233,0.35)',
              backdropFilter: 'blur(18px)',
            }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${isPetition ? 'text-orange-400' : 'text-sky-400'}`}>
                  {isPetition ? 'Rezoning Petition' : 'ArcGIS Parcel'}
                </div>
                <div className="text-white font-bold text-sm leading-tight">
                  {isPetition
                    ? (selectedParcel.petition_number || selectedParcel.location || selectedParcel.address || 'Petition Parcel')
                    : (selectedParcel.site_address || selectedParcel.address || 'No address')}
                </div>
              </div>
              <button onClick={() => setSelectedParcel(null)}
                className="text-gray-600 hover:text-gray-300 transition-colors ml-2 mt-0.5 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Details grid — petition vs arcgis */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {(isPetition ? [
                { label: 'Petition #',      value: selectedParcel.petition_number },
                { label: 'PIN',             value: selectedParcel.pin },
                { label: 'Location',        value: selectedParcel.location || selectedParcel.address, span: true },
                { label: 'Current Zoning',  value: selectedParcel.current_zoning },
                { label: 'Proposed Zoning', value: selectedParcel.proposed_zoning },
                { label: 'Petitioner',      value: selectedParcel.petitioner, span: true },
                { label: 'Status',          value: selectedParcel.status },
                { label: 'Vote',            value: selectedParcel.vote_result },
              ] : [
                { label: 'PIN',         value: selectedParcel.pin },
                { label: 'Owner',       value: selectedParcel.owner, span: true },
                { label: 'Assessed',    value: selectedParcel.total_value_assd ? `$${fmt(selectedParcel.total_value_assd)}` : null },
                { label: 'Year Built',  value: selectedParcel.year_built },
                { label: 'Heated Sqft', value: selectedParcel.heated_area ? `${fmt(selectedParcel.heated_area)} sf` : null },
                { label: 'Type',        value: selectedParcel.type_and_use },
              ]).map(({ label, value, span }) =>
                value ? (
                  <div key={label} className={span ? 'col-span-2' : ''}>
                    <span className="text-gray-600 block">{label}</span>
                    <span className="text-gray-200 font-medium truncate block">{value}</span>
                  </div>
                ) : null,
              )}
            </div>

            {/* Lender verify link */}
            <a
              href={`/lender?pin=${selectedParcel.pin || selectedParcel.arcgis_pin}&county_id=raleigh_nc`}
              className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90"
              style={{ background: isPetition ? 'rgba(249,115,22,0.15)' : 'rgba(14,165,233,0.15)',
                       border: isPetition ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(14,165,233,0.3)',
                       color: isPetition ? '#fb923c' : '#38bdf8' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify in Lender Portal
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Chat panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ x: -480, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -480, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute left-0 top-0 h-full w-[480px] z-30 flex flex-col"
            style={{ background: 'rgba(6,6,6,0.97)', borderRight: '1px solid rgba(255,68,0,0.15)', backdropFilter: 'blur(20px)' }}>
            <ChatAssistant onPetitionsHighlight={handlePetitionsHighlight} onPetitionClick={handlePetitionClick} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
