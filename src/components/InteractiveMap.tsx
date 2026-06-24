/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Issue, IssueCategory } from '../types';
import { Sliders, Eye, Locate, Loader2, Info, Moon, Sun, Globe, Map as MapIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface InteractiveMapProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  selectedIssueId?: string;
  theme?: 'dark' | 'light';
}

export default function InteractiveMap({ issues, onSelectIssue, selectedIssueId, theme = 'dark' }: InteractiveMapProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [heatmapMode, setHeatmapMode] = useState<boolean>(false);
  const [mapMode, setMapMode] = useState<'dark' | 'light' | 'satellite' | 'street'>('dark');
  const [mapReady, setMapReady] = useState<boolean>(false);

  // States for user location beacon on the map
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState<boolean>(false);
  const [locError, setLocError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Geolocation trigger
  const fetchMyLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    setLocLoading(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLoc({ lat: latitude, lng: longitude });
        setLocLoading(false);
      },
      (err) => {
        console.error("Map geolocation error:", err);
        let msg = "Unable to fetch location.";
        if (err.code === 1) {
          msg = "Location permission denied. Please grant permission in your browser's address bar to let the radar find you.";
        } else if (err.code === 2) {
          msg = "GPS position unavailable. Please verify your device's location services are active.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please try again.";
        } else {
          msg = "Blocked by browser security. Try opening the preview in a new tab.";
        }
        setLocError(msg);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Helper colors and icons
  const getCategoryColor = (cat: IssueCategory) => {
    switch (cat) {
      case 'road': return 'from-amber-400 to-amber-600 bg-amber-500';
      case 'garbage': return 'from-emerald-400 to-emerald-600 bg-emerald-500';
      case 'water': return 'from-sky-400 to-sky-600 bg-sky-500';
      case 'streetlight': return 'from-yellow-300 to-amber-500 bg-yellow-400';
      case 'safety': return 'from-rose-400 to-red-600 bg-red-500';
    }
  };

  const getCategoryEmoji = (cat: IssueCategory) => {
    switch (cat) {
      case 'road': return '⚠️';
      case 'garbage': return '🗑️';
      case 'water': return '🚰';
      case 'streetlight': return '💡';
      case 'safety': return '🚨';
    }
  };

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    const matchesCat = filterCategory === 'all' || issue.category === filterCategory;
    const matchesSev = filterSeverity === 'all' || issue.severity === filterSeverity;
    return matchesCat && matchesSev;
  });

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Use a beautiful, high-contrast dark tileset (CartoDB Dark Matter) as initial default
    const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    });

    // Default map coordinates center on San Francisco (where demo issues are plotted)
    const map = L.map(mapContainerRef.current, {
      center: [37.771, -122.416],
      zoom: 14,
      zoomControl: false,
      layers: [darkTiles]
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    tileLayerRef.current = darkTiles;
    markersLayerRef.current = markersLayer;
    setMapReady(true);

    // Handle initial map size adjustment
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersLayerRef.current = null;
      userMarkerRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // 1.1 Dynamic Map Style/Mode Swapping Effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove existing tile layer safely
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    if (mapMode === 'light') {
      url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    } else if (mapMode === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else if (mapMode === 'street') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }

    const newTiles = L.tileLayer(url, {
      attribution,
      subdomains: 'abcd',
      maxZoom: 20
    });

    newTiles.addTo(map);
    tileLayerRef.current = newTiles;
  }, [mapMode, mapReady]);

  // 2. Synchronize Map Markers with filtered issues
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    // Clear existing markers
    markersLayer.clearLayers();

    filteredIssues.forEach((issue) => {
      const isSelected = selectedIssueId === issue.id;
      const gradient = getCategoryColor(issue.category);
      const emoji = getCategoryEmoji(issue.category);

      const isHighUrgency = issue.severity === 'high' && issue.status !== 'closed';
      const isActive = issue.status !== 'closed';

      // Build premium custom interactive HTML markers
      let markerHtml = '';
      
      if (heatmapMode) {
        // High thermal density representation
        const heatColor = issue.severity === 'high' ? 'rgba(239, 68, 68, 0.5)' : issue.severity === 'medium' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)';
        markerHtml = `
          <div class="relative w-16 h-16 rounded-full transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center animate-pulse"
               style="background: radial-gradient(circle, ${heatColor} 0%, rgba(0,0,0,0) 75%)">
            <div class="w-3.5 h-3.5 rounded-full ${issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'} ring-4 ring-black border border-white/40 shadow-glow"></div>
          </div>
        `;
      } else {
        // Custom interactive visual radar pins
        markerHtml = `
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-lg border-2 text-sm transition-all duration-300 ${
            isSelected 
              ? 'border-indigo-400 scale-125 ring-4 ring-indigo-500/30' 
              : 'border-white/90 dark:border-slate-800 scale-100 hover:scale-115'
          } bg-gradient-to-br ${gradient}">
            <span class="select-none text-base">${emoji}</span>
            ${issue.status === 'community_verified' || issue.status === 'resolved' ? `
              <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white border border-white">✓</span>
            ` : ''}
            ${issue.escalated ? `
              <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[7px] font-bold text-white border border-white animate-pulse">🚨</span>
            ` : ''}
            ${isHighUrgency ? `
              <div class="absolute inset-0 -m-3 rounded-full bg-red-500/20 animate-ping opacity-60 pointer-events-none"></div>
            ` : ''}
            ${isActive ? `
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-indigo-500/20 bg-indigo-500/5 pointer-events-none animate-sonar-ripple"></div>
            ` : ''}
          </div>
        `;
      }

      const customIcon = L.divIcon({
        html: markerHtml,
        className: heatmapMode ? 'custom-heat-pin' : 'custom-map-pin',
        iconSize: heatmapMode ? [64, 64] : [32, 32],
        iconAnchor: heatmapMode ? [32, 32] : [16, 16],
      });

      const marker = L.marker([issue.location.lat, issue.location.lng], { icon: customIcon });

      // Custom popup design matching the app's dark slate look
      const popupContent = `
        <div class="p-1 min-w-[210px] text-slate-100 font-sans">
          <div class="flex items-center gap-1.5 mb-1.5 text-[9px] font-bold uppercase tracking-wider">
            <span class="px-2 py-0.5 rounded text-white bg-gradient-to-r ${gradient}">${issue.category.toUpperCase()}</span>
            <span class="px-2 py-0.5 rounded text-white ${
              issue.severity === 'high' ? 'bg-rose-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
            }">${issue.severity.toUpperCase()}</span>
          </div>
          <h4 class="text-xs font-bold text-white mb-1 leading-tight">${issue.title}</h4>
          <p class="text-[10px] text-slate-300 leading-normal mb-2.5 line-clamp-3">${issue.description}</p>
          <div class="flex justify-between items-center text-[8px] text-slate-400 border-t border-slate-800 pt-2 mt-1">
            <span class="truncate max-w-[130px] italic">📍 ${issue.location.address}</span>
            <span class="text-emerald-400 font-bold ml-1.5 whitespace-nowrap">Score: ${issue.upvotes - issue.downvotes}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'custom-leaflet-popup',
        closeButton: false,
      });

      // Synchronize selection back to parent component
      marker.on('click', () => {
        onSelectIssue(issue);
      });

      markersLayer.addLayer(marker);

      // If issue is currently selected, trigger fly-to and open popup!
      if (isSelected) {
        setTimeout(() => {
          marker.openPopup();
          map.setView([issue.location.lat, issue.location.lng], Math.max(map.getZoom(), 15));
        }, 100);
      }
    });
  }, [filteredIssues, selectedIssueId, heatmapMode, onSelectIssue]);

  // 3. User Live Location Marker Synchronization
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLoc) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLoc.lat, userLoc.lng]);
    } else {
      const userIconHtml = `
        <div class="relative w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 border-2 border-white shadow-xl flex items-center justify-center animate-pulse pointer-events-none">
          <div class="absolute inset-0 -m-4 rounded-full bg-indigo-500/20 animate-ping opacity-75"></div>
          <div class="absolute inset-0 -m-2.5 rounded-full bg-sky-500/25 animate-sonar-ripple"></div>
          <div class="w-2 h-2 rounded-full bg-white"></div>
          <span class="absolute -bottom-5 bg-indigo-600 text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded shadow-md border border-indigo-400/40 tracking-wider whitespace-nowrap">YOU</span>
        </div>
      `;

      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'user-map-pin',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const userMarker = L.marker([userLoc.lat, userLoc.lng], { icon: userIcon }).addTo(map);
      userMarkerRef.current = userMarker;
    }

    // Smoothly fly to user's location coordinates with a higher zoom level
    map.flyTo([userLoc.lat, userLoc.lng], 15, {
      animate: true,
      duration: 1.5
    });
  }, [userLoc]);

  return (
    <div className="relative w-full overflow-hidden bento-card shadow-2xl transition-all duration-300">
      
      {/* Map Control Header */}
      <div className={`p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b backdrop-blur-md transition-all ${
        theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/40'
      }`}>
        <div>
          <h3 className={`text-lg font-bold font-display flex items-center gap-2 transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-slate-800'
          }`}>
            <Sliders className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            Tactical Navigation Radar
          </h3>
          <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Interactive live maps plotting community reports globally</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto z-10">
          {/* Category */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors ${
              theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            <option value="all">📁 All Categories</option>
            <option value="road">🚧 Road Damage</option>
            <option value="garbage">🚮 Garbage Overflow</option>
            <option value="water">💧 Water Leakage</option>
            <option value="streetlight">💡 Streetlight Out</option>
            <option value="safety">🚨 Public Safety</option>
          </select>

          {/* Severity */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors ${
              theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            <option value="all">⚡ All Severities</option>
            <option value="high">🔴 High Urgency</option>
            <option value="medium">🟡 Medium Urgency</option>
            <option value="low">🟢 Low Urgency</option>
          </select>

          {/* Heatmap Toggle */}
          <button
            onClick={() => setHeatmapMode(!heatmapMode)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all duration-300 cursor-pointer ${
              heatmapMode
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-rose-500/25'
                : theme === 'dark'
                  ? 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 hover:text-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {heatmapMode ? 'Thermal Density Mode' : 'Standard Pin Mode'}
          </button>
        </div>
      </div>

      {/* Map Mapbox Container */}
      <div className="relative w-full aspect-[1000/600] min-h-[400px] md:min-h-[500px] bg-[#070913] overflow-hidden select-none">
        
        {/* Leaflet container ref */}
        <div ref={mapContainerRef} className="absolute inset-0 z-0 w-full h-full" />

        {/* Overlaying HUD Grid Lines to match futuristic sci-fi theme */}
        <div className="absolute inset-0 pointer-events-none z-10 border border-indigo-500/5 mix-blend-color-dodge bg-grid-pattern opacity-10" />

        {/* Floating GPS Location Widget */}
        <div className="absolute top-4 left-4 z-30 flex flex-col gap-2 max-w-[280px]">
          <button
            onClick={fetchMyLocation}
            disabled={locLoading}
            className={`p-2.5 rounded-xl border font-bold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md ${
              userLoc 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-emerald-500/5 hover:bg-emerald-500/25'
                : 'bg-[#0a0c14]/90 border-white/10 text-white hover:bg-white/10'
            }`}
            title="Fetch your browser location and zoom map directly to you"
          >
            {locLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            ) : (
              <Locate className={`w-3.5 h-3.5 ${userLoc ? 'text-emerald-400' : 'text-indigo-400'}`} />
            )}
            <span>{locLoading ? "Locking GPS..." : userLoc ? "Location Locked" : "Find Me on Map"}</span>
          </button>

          {/* Show coordinates or warning alert */}
          {userLoc && (
            <div className="p-2.5 rounded-xl bg-[#0a0c14]/95 border border-emerald-500/25 text-emerald-400 text-[10px] shadow-md leading-tight backdrop-blur-sm animate-fadeIn">
              <p className="font-bold uppercase tracking-wider text-[8px] text-emerald-500 mb-0.5">Your Radar Coordinate</p>
              <p className="font-mono">{userLoc.lat.toFixed(5)}, {userLoc.lng.toFixed(5)}</p>
              <p className="text-gray-400 text-[8px] mt-1">
                You are live on the tactical grid.
              </p>
            </div>
          )}

          {locError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] shadow-md leading-normal backdrop-blur-sm animate-fadeIn">
              <p className="font-bold uppercase tracking-wider text-[8px] text-amber-400 mb-1">GPS Lock Issue</p>
              <p>{locError}</p>
            </div>
          )}
        </div>

        {/* Floating Map Mode Selector (Top Right) */}
        <div className="absolute top-4 right-4 z-30 flex gap-1 p-1 rounded-xl bg-[#0a0c14]/90 border border-white/10 backdrop-blur-md shadow-xl">
          <button
            onClick={() => setMapMode('dark')}
            aria-label="Tactical Dark Mode"
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mapMode === 'dark'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Sleek High-Contrast Tactical Dark Grid"
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dark</span>
          </button>
          
          <button
            onClick={() => setMapMode('light')}
            aria-label="Legible Light Mode"
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mapMode === 'light'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Clean, Highly Legible Light Style"
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Light</span>
          </button>

          <button
            onClick={() => setMapMode('satellite')}
            aria-label="Satellite Imagery Mode"
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mapMode === 'satellite'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Real Satellite Imagery Aerial View"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Satellite</span>
          </button>

          <button
            onClick={() => setMapMode('street')}
            aria-label="Detailed Street Mode"
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mapMode === 'street'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Detailed Standard Street Map"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Street</span>
          </button>
        </div>

        {/* Legend Panel */}
        <div className="absolute bottom-3 right-3 p-3.5 rounded-xl bg-[#0a0c14]/90 backdrop-blur-md border border-white/10 shadow-lg text-[10px] text-gray-300 pointer-events-none z-30">
          <div className="font-bold mb-1.5 flex items-center gap-1 text-white uppercase tracking-wider text-[9px]">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            Legend
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
            <span className="flex items-center gap-1.5">⚠️ Road</span>
            <span className="flex items-center gap-1.5">🗑️ Waste</span>
            <span className="flex items-center gap-1.5">🚰 Water Leak</span>
            <span className="flex items-center gap-1.5">💡 Lighting</span>
            <span className="flex items-center gap-1.5">🚨 Safety</span>
            <span className="flex items-center gap-1.5 text-blue-400 font-medium">✓ Verified</span>
          </div>
        </div>

      </div>
    </div>
  );
}
