import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { motion, AnimatePresence } from 'framer-motion';
import api, { durham } from '../services/api';
import { estimateParcelValue, formatUsd, formatAdi } from '../utils/durhamPricing';
import ChatAssistant from '../components/ChatAssistant';
import CustomCursor from '../components/CustomCursor';
import WalletButton from '../components/WalletButton';
import ClaimModal from '../components/ClaimModal';
import ListModal from '../components/ListModal';
import BuyPanel from '../components/BuyPanel';
import WalletDashboard from '../components/WalletDashboard';
import Marketplace from '../components/Marketplace';
import './MapView.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DEFAULT_CENTER = [
  parseFloat(import.meta.env.VITE_DEFAULT_MAP_CENTER_LNG),
  parseFloat(import.meta.env.VITE_DEFAULT_MAP_CENTER_LAT),
];
const DEFAULT_ZOOM = parseInt(import.meta.env.VITE_DEFAULT_MAP_ZOOM);

mapboxgl.accessToken = MAPBOX_TOKEN;

const MAP_STYLES = {
  dark:      { name: 'Dark',      url: 'mapbox://styles/mapbox/dark-v11' },
  streets:   { name: 'Streets',   url: 'mapbox://styles/mapbox/streets-v12' },
  satellite: { name: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
};

const ALL_COUNTIES = [
  { id: 'all', name: 'All Counties', state: '' },
  { id: 'charlotte_nc', name: 'Charlotte', state: 'NC' },
  { id: 'durham_nc', name: 'Durham', state: 'NC' },
  { id: 'raleigh_nc', name: 'Raleigh', state: 'NC' },
];

function MapsDurham() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const allFeaturesRef = useRef([]);
  const tokenizedPinsRef = useRef({});

  const [loading, setLoading] = useState(true);
  const [currentStyle, setCurrentStyle] = useState('dark');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [parcelCount, setParcelCount] = useState(0);
  const [selectedCounty, setSelectedCounty] = useState('all');

  const [selectedParcel, setSelectedParcel] = useState(null);
  const [parcelInfoPosition, setParcelInfoPosition] = useState({ x: 0, y: 0 });

  const [wallet, setWallet] = useState(null);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [buyListing, setBuyListing] = useState(null);
  const [showWalletDashboard, setShowWalletDashboard] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[currentStyle].url,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right'
    );

    map.current.on('load', async () => {
      setLoading(false);
      await loadAllCounties();
      await refreshTokenizedLayer();
    });
  }, []);

  const loadAllCounties = async () => {
    try {
      const results = await Promise.allSettled([
        api.getParcelsGeoJSON('charlotte_nc'),
        api.getParcelsGeoJSON('durham_nc'),
        api.getParcelsGeoJSON('raleigh_nc'),
      ]);

      const countyIds = ['charlotte_nc', 'durham_nc', 'raleigh_nc'];
      const allFeatures = [];

      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value?.features) {
          result.value.features.forEach(f => {
            allFeatures.push({
              ...f,
              properties: { ...f.properties, county_id: countyIds[i] },
            });
          });
        }
      });

      allFeaturesRef.current = allFeatures;
      renderFeatures(allFeatures);
    } catch (error) {
      console.error('Error loading all counties:', error);
    }
  };

  const refreshTokenizedLayer = useCallback(async () => {
    try {
      const { tokenized } = await durham.getTokenized('durham_nc');
      const pinMap = {};
      if (tokenized && Array.isArray(tokenized)) {
        tokenized.forEach(t => { pinMap[t.pin] = t; });
      }
      tokenizedPinsRef.current = pinMap;

      updateTokenizedLayer(Object.keys(pinMap));
    } catch (err) {
      console.error('Failed to load tokenized parcels:', err);
    }
  }, []);

  // County filtering effect
  useEffect(() => {
    if (!map.current || loading || allFeaturesRef.current.length === 0) return;

    setSelectedParcel(null);

    if (selectedCounty === 'all') {
      const src = map.current.getSource('parcels');
      if (src) {
        src.setData({ type: 'FeatureCollection', features: allFeaturesRef.current });
        setParcelCount(allFeaturesRef.current.length);
        fitToFeatures(allFeaturesRef.current);
      }
    } else {
      const filtered = allFeaturesRef.current.filter(
        f => f.properties.county_id === selectedCounty
      );
      const src = map.current.getSource('parcels');
      if (src) {
        src.setData({ type: 'FeatureCollection', features: filtered });
        setParcelCount(filtered.length);
        fitToFeatures(filtered);
      }
    }
  }, [selectedCounty, loading]);

  const updateTokenizedLayer = (tokenizedPins) => {
    if (!map.current || !map.current.getLayer('parcels-fill')) return;

    if (tokenizedPins.length === 0) {
      map.current.setPaintProperty('parcels-fill', 'fill-color', '#ff4400');
      map.current.setPaintProperty('parcels-outline', 'line-color', '#ff4400');
      return;
    }

    map.current.setPaintProperty('parcels-fill', 'fill-color', [
      'case',
      ['in', ['get', 'petition_number'], ['literal', tokenizedPins]],
      '#f59e0b',
      '#ff4400',
    ]);
    map.current.setPaintProperty('parcels-fill', 'fill-opacity', [
      'case',
      ['in', ['get', 'petition_number'], ['literal', tokenizedPins]],
      0.75,
      0.5,
    ]);
    map.current.setPaintProperty('parcels-outline', 'line-color', [
      'case',
      ['in', ['get', 'petition_number'], ['literal', tokenizedPins]],
      '#f59e0b',
      '#ff4400',
    ]);
    map.current.setPaintProperty('parcels-outline', 'line-width', [
      'case',
      ['in', ['get', 'petition_number'], ['literal', tokenizedPins]],
      3,
      2,
    ]);
  };

  const renderFeatures = (features) => {
    if (!map.current) return;

    const geojson = { type: 'FeatureCollection', features };

    ['parcels-fill', 'parcels-outline'].forEach(id => {
      if (map.current.getLayer(id)) map.current.removeLayer(id);
    });
    if (map.current.getSource('parcels')) map.current.removeSource('parcels');

    if (features.length === 0) {
      setParcelCount(0);
      return;
    }

    setParcelCount(features.length);

    map.current.addSource('parcels', { type: 'geojson', data: geojson });

    map.current.addLayer({
      id: 'parcels-fill',
      type: 'fill',
      source: 'parcels',
      paint: {
        'fill-color': '#ff4400',
        'fill-opacity': 0.5,
      },
    });

    map.current.addLayer({
      id: 'parcels-outline',
      type: 'line',
      source: 'parcels',
      paint: {
        'line-color': '#ff4400',
        'line-width': 2,
        'line-opacity': 0.9,
      },
    });

    updateTokenizedLayer(Object.keys(tokenizedPinsRef.current));

    map.current.on('click', 'parcels-fill', (e) => {
      const properties = e.features[0].properties;
      const point = map.current.project(e.lngLat);
      const chatPanelRight = isChatOpen ? window.innerWidth * 0.30 + 24 : 0;
      const cardWidth = 420;
      const cardHeight = 520;
      const margin = 20;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = point.x + margin;
      if (x < chatPanelRight + margin) x = chatPanelRight + margin;
      if (x + cardWidth > viewportWidth - margin) x = point.x - cardWidth - margin;

      let y = point.y - 20;
      if (y + cardHeight > viewportHeight - margin) y = viewportHeight - cardHeight - margin;
      if (y < margin) y = margin;

      setSelectedParcel(properties);
      setParcelInfoPosition({ x, y });
      setShowBuyPanel(false);
      setShowClaimModal(false);
      setShowListModal(false);
    });

    map.current.on('mouseenter', 'parcels-fill', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'parcels-fill', () => {
      map.current.getCanvas().style.cursor = '';
    });

    fitToFeatures(features);
  };

  const fitToFeatures = (features) => {
    if (!features || !features.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    features.forEach((feature) => {
      if (!feature.geometry || !feature.geometry.coordinates) return;

      if (feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0];
        if (coords && Array.isArray(coords)) {
          coords.forEach(coord => bounds.extend(coord));
        }
      } else if (feature.geometry.type === 'MultiPolygon') {
        const polys = feature.geometry.coordinates;
        if (polys && Array.isArray(polys)) {
          polys.forEach(poly => {
            if (poly[0] && Array.isArray(poly[0])) {
              poly[0].forEach(coord => bounds.extend(coord));
            }
          });
        }
      }
    });
    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 50, duration: 800 });
    }
  };

  const changeMapStyle = (styleKey) => {
    if (!map.current) return;
    setCurrentStyle(styleKey);
    map.current.setStyle(MAP_STYLES[styleKey].url);
    map.current.once('styledata', () => {
      renderFeatures(allFeaturesRef.current);
    });
    setShowLayerMenu(false);
  };

  const handlePetitionsHighlight = (petitionIds) => {
    if (!map.current) return;

    if (petitionIds.length > 0) {
      if (map.current.getLayer('parcels-fill')) {
        map.current.setPaintProperty('parcels-fill', 'fill-color', [
          'case',
          ['in', ['get', 'petition_number'], ['literal', petitionIds]],
          '#fbbf24',
          '#ff4400',
        ]);
        map.current.setPaintProperty('parcels-fill', 'fill-opacity', [
          'case',
          ['in', ['get', 'petition_number'], ['literal', petitionIds]],
          0.9,
          0.2,
        ]);
      }
    } else {
      if (map.current.getLayer('parcels-fill')) {
        map.current.setPaintProperty('parcels-fill', 'fill-color', '#ff4400');
        map.current.setPaintProperty('parcels-fill', 'fill-opacity', 0.5);
      }
    }
  };

  const handleFocusParcel = (pin, geometry) => {
    if (!map.current || !geometry) return;
    const bounds = new mapboxgl.LngLatBounds();
    if (geometry.type === 'Polygon') {
      geometry.coordinates[0].forEach(coord => bounds.extend(coord));
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(poly => poly[0].forEach(coord => bounds.extend(coord)));
    }
    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 120, duration: 900, maxZoom: 18 });
    }
  };

  const handleClaimClick = () => {
    if (!selectedParcel) return;
    const pin = selectedParcel.petition_number || selectedParcel.pin;
    const tokenizedRow = tokenizedPinsRef.current[pin];

    if (tokenizedRow?.listed && tokenizedRow.listed_shares > 0) {
      setBuyListing(tokenizedRow);
      setShowBuyPanel(true);
      setSelectedParcel(null);
    } else if (tokenizedRow && !tokenizedRow.listed && tokenizedRow.owner_wallet?.toLowerCase() === wallet?.toLowerCase()) {
      setShowListModal(true);
    } else {
      setShowClaimModal(true);
    }
  };

  const isTokenized = selectedParcel
    ? !!tokenizedPinsRef.current[selectedParcel.petition_number || selectedParcel.pin]
    : false;

  const tokenizedRow = selectedParcel
    ? tokenizedPinsRef.current[selectedParcel.petition_number || selectedParcel.pin]
    : null;

  const isListed = tokenizedRow?.listed && tokenizedRow.listed_shares > 0;
  // Compare Ethereum addresses in lowercase (case-insensitive)
  const isOwner = isTokenized && wallet && tokenizedRow?.owner_wallet?.toLowerCase() === wallet?.toLowerCase();
  const isPendingVerification = tokenizedRow?.verification_status === 'pending';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <CustomCursor />

      {/* Map Background */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-10 px-6 pb-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3 bg-black/80 backdrop-blur-xl px-6 py-3 rounded-2xl border border-red-500/20"
          >
            <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-black text-white">TOWNHALL</h1>
              <p className="text-xs text-gray-500">Durham County • ADI Chain</p>
            </div>
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3"
          >
            {/* Parcel Count */}
            <div className="bg-black/80 backdrop-blur-xl px-4 py-3 rounded-2xl border border-red-500/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white font-bold">{parcelCount}</span>
                <span className="text-gray-400 text-sm">Parcels</span>
              </div>
            </div>

            {/* Tokenized count badge */}
            {Object.keys(tokenizedPinsRef.current).length > 0 && (
              <div className="bg-black/80 backdrop-blur-xl px-4 py-3 rounded-2xl border border-amber-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-amber-400 font-bold">{Object.keys(tokenizedPinsRef.current).length}</span>
                  <span className="text-gray-400 text-sm">Tokenized</span>
                </div>
              </div>
            )}

            {/* County Selector */}
            <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-red-500/20 overflow-hidden">
              <select
                value={selectedCounty}
                onChange={(e) => setSelectedCounty(e.target.value)}
                className="bg-transparent text-white font-medium px-4 py-3 border-none focus:outline-none focus:ring-2 focus:ring-red-500/50 rounded-2xl cursor-pointer"
              >
                {ALL_COUNTIES.map((county) => (
                  <option key={county.id} value={county.id} className="bg-black">
                    {county.state ? `${county.name}, ${county.state}` : county.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Marketplace Button */}
            <button
              onClick={() => setShowMarketplace(true)}
              className="bg-black/80 backdrop-blur-xl rounded-2xl border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all px-4 py-3 flex items-center gap-2"
              title="Open Marketplace"
            >
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-white font-medium text-sm">Marketplace</span>
            </button>

            {/* Layer Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowLayerMenu(!showLayerMenu)}
                className="w-12 h-12 bg-black/80 backdrop-blur-xl rounded-2xl border border-red-500/20 flex items-center justify-center hover:bg-red-500/10 transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </button>

              <AnimatePresence>
                {showLayerMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute top-14 right-0 bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-red-500/20 p-2 min-w-[160px]"
                  >
                    {Object.entries(MAP_STYLES).map(([key, style]) => (
                      <button
                        key={key}
                        onClick={() => changeMapStyle(key)}
                        className={`w-full px-4 py-3 text-left text-sm rounded-xl transition-all ${
                          currentStyle === key
                            ? 'bg-red-500/20 text-red-400 font-bold'
                            : 'text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        {style.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Wallet Button */}
            <WalletButton
              wallet={wallet}
              onConnect={setWallet}
              onDisconnect={() => { setWallet(null); setShowWalletDashboard(false); }}
              onOpenDashboard={() => setShowWalletDashboard(true)}
              chainType="adi"
            />
          </motion.div>
        </div>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute left-6 top-28 bottom-6 w-[30vw] z-10"
          >
            <div className="h-full bg-black/80 backdrop-blur-xl rounded-3xl border border-red-500/20 shadow-2xl overflow-hidden">
              <ChatAssistant
                onPetitionsHighlight={handlePetitionsHighlight}
                countyId="durham_nc"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Chat Button */}
      {!isChatOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsChatOpen(true)}
          className="absolute left-6 bottom-6 z-20 w-16 h-16 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-full shadow-2xl shadow-red-500/50 flex items-center justify-center hover:scale-110 transition-transform"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </motion.button>
      )}

      {isChatOpen && (
        <button
          onClick={() => setIsChatOpen(false)}
          className="absolute left-[calc(30vw+4px)] top-32 z-20 p-2 bg-black/80 backdrop-blur-xl hover:bg-red-500/20 rounded-full text-red-500 transition-all border border-red-500/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Parcel Info Overlay */}
      <AnimatePresence>
        {selectedParcel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedParcel(null)}
              className="absolute inset-0 z-30"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="absolute z-40 pointer-events-auto"
              style={{ left: `${parcelInfoPosition.x}px`, top: `${parcelInfoPosition.y}px` }}
            >
              <div className="bg-black/95 backdrop-blur-xl rounded-2xl border border-red-500/30 shadow-2xl shadow-red-500/20 overflow-hidden min-w-[360px] max-w-[420px]">
                {/* Header */}
                <div className={`px-6 py-4 border-b border-red-500/20 flex items-center justify-between ${isTokenized ? 'bg-gradient-to-r from-amber-600/20 to-yellow-600/20' : 'bg-gradient-to-r from-red-600/20 to-orange-600/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isTokenized ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
                      <svg className={`w-5 h-5 ${isTokenized ? 'text-amber-400' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className={`font-black text-lg uppercase tracking-wide ${isTokenized ? 'text-amber-400' : 'text-red-400'}`}>
                        {selectedParcel.petition_number || 'Unknown'}
                      </h3>
                      <p className="text-gray-500 text-xs flex items-center gap-1">
                        {isTokenized
                          ? <><span className="w-1.5 h-1.5 bg-amber-400 rounded-full inline-block" /> Tokenized on ADI Chain</>
                          : selectedParcel.file_number ? `File: ${selectedParcel.file_number}` : 'Petition Details'
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedParcel(null)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
                  {(selectedParcel.location || selectedParcel.address) && (
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Location</div>
                      <div className="text-white font-medium text-sm">{selectedParcel.location || selectedParcel.address}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Current Zoning</div>
                      <div className="text-white font-medium text-sm">{selectedParcel.current_zoning || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Area</div>
                      <div className="text-white font-medium text-sm">
                        {selectedParcel.area_sqft ? `${selectedParcel.area_sqft.toLocaleString()} sqft` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Market Value Estimate */}
                  {(() => {
                    const zoning = selectedParcel.current_zoning || selectedParcel.zoning;
                    if (!zoning) return null;
                    const areaSqft = selectedParcel.area_sqft || null;
                    const { valueUsd, valueAdi, valueAdiPerShare, multiplier, acreage } = estimateParcelValue(zoning, areaSqft);
                    const isAboveBase = multiplier >= 1;
                    return (
                      <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-xl p-3.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Est. Market Value</div>
                            <div className="text-2xl font-black text-emerald-400">{formatAdi(valueAdi)}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {formatUsd(valueUsd)} · {zoning} · {multiplier.toFixed(2)}× base
                            </div>
                            {acreage && (
                              <div className="text-xs text-gray-600 mt-0.5">
                                {acreage} ac · {Math.round(areaSqft).toLocaleString()} sqft
                              </div>
                            )}
                            <div className="text-xs text-amber-400/80 mt-0.5 font-medium">
                              ~{valueAdiPerShare.toLocaleString()} ADI / share · 1,000 shares total
                            </div>
                          </div>
                          <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl border ${isAboveBase ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-orange-500/15 border-orange-500/30 text-orange-400'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isAboveBase ? 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' : 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6'} />
                            </svg>
                            <span className="text-[10px] font-bold mt-0.5">{isAboveBase ? '+' : ''}{((multiplier - 1) * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer */}
                <div className="bg-red-500/5 px-5 py-3 border-t border-red-500/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const zoning = selectedParcel.current_zoning || selectedParcel.zoning;
                      if (!zoning) return null;
                      const { valueUsd, valueAdi, acreage } = estimateParcelValue(zoning, selectedParcel.area_sqft || null);
                      return (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Est. Value</span>
                          <span className="text-emerald-400 font-black text-base leading-tight">{formatAdi(valueAdi)}</span>
                          <span className="text-gray-600 text-[10px]">{formatUsd(valueUsd)}{acreage ? ` · ${acreage} ac` : ''}</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-2">
                    {wallet ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClaimClick(); }}
                        className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all ${
                          isListed
                            ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                            : isPendingVerification
                              ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 cursor-default'
                              : isOwner && !isListed
                                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                                : isTokenized
                                  ? 'bg-white/10 border border-white/20 text-gray-400 cursor-default'
                                  : 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                        }`}
                        disabled={isPendingVerification || (isTokenized && !isListed && !isOwner)}
                      >
                        {isListed
                          ? 'Buy Shares'
                          : isPendingVerification
                            ? 'Pending Verification'
                            : isOwner && !isListed
                              ? 'List Shares'
                              : isTokenized
                                ? 'Tokenized'
                                : 'Claim Parcel'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">Connect wallet to claim</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Claim Modal */}
      {showClaimModal && selectedParcel && wallet && (
        <ClaimModal
          parcel={selectedParcel}
          wallet={wallet}
          onClose={() => { setShowClaimModal(false); setSelectedParcel(null); }}
          onMinted={() => {
            setShowClaimModal(false);
            setSelectedParcel(null);
            refreshTokenizedLayer();
          }}
          serviceType="durham"
        />
      )}

      {/* List Modal */}
      {showListModal && selectedParcel && wallet && tokenizedRow && (
        <ListModal
          parcel={tokenizedRow}
          wallet={wallet}
          onClose={() => { setShowListModal(false); setSelectedParcel(null); }}
          onListed={() => {
            setShowListModal(false);
            setSelectedParcel(null);
            refreshTokenizedLayer();
          }}
          serviceType="durham"
        />
      )}

      {/* Buy Panel */}
      {showBuyPanel && buyListing && wallet && (
        <BuyPanel
          listing={buyListing}
          wallet={wallet}
          onClose={() => { setShowBuyPanel(false); setBuyListing(null); }}
          onBought={() => {
            refreshTokenizedLayer();
          }}
          serviceType="durham"
        />
      )}

      {/* Wallet Dashboard */}
      {showWalletDashboard && wallet && (
        <WalletDashboard
          wallet={wallet}
          onClose={() => setShowWalletDashboard(false)}
          onFocusParcel={handleFocusParcel}
          serviceType="durham"
        />
      )}

      {/* Marketplace */}
      {showMarketplace && (
        <Marketplace
          serviceType="durham"
          onClose={() => setShowMarketplace(false)}
          onSelectParcel={(listing) => {
            setShowMarketplace(false);
            setBuyListing(listing);
            setShowBuyPanel(true);
          }}
          onFocusParcel={(pin, geometry) => {
            setShowMarketplace(false);
            handleFocusParcel(pin, geometry);
          }}
        />
      )}

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
              <p className="text-white font-bold text-lg">Loading Durham County...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MapsDurham;
