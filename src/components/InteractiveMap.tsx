/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { Issue, IssueCategory, User, SeverityLevel } from '../types';
import { 
  Sliders, Eye, Locate, Loader2, Info, Moon, Sun, Globe, Map as MapIcon,
  X, Navigation, Share2, ThumbsUp, ThumbsDown, MessageSquare, Clock, ArrowRight,
  PlusCircle, User as UserIcon, Check, MapPin, AlertTriangle, Shield, CheckCircle
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import 'leaflet.heat';

interface InteractiveMapProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  selectedIssueId?: string;
  theme?: 'dark' | 'light';
  onLocationResolved?: (city: string, area: string) => void;
  onVoteIssue?: (issueId: string, voteType: 'valid' | 'invalid') => void;
  currentUser?: User | null;
}

interface SelectedMapLocation {
  type: 'issue' | 'point';
  lat: number;
  lng: number;
  address: string;
  area?: string;
  city?: string;
  issue?: Issue;
}

interface RouteData {
  coordinates: [number, number][];
  distance: number; // in meters
  duration: number; // in seconds
  steps: { instruction: string; distance: number }[];
}

export default function InteractiveMap({ 
  issues, 
  onSelectIssue, 
  selectedIssueId, 
  theme = 'dark',
  onLocationResolved,
  onVoteIssue,
  currentUser
}: InteractiveMapProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [heatmapMode, setHeatmapMode] = useState<boolean>(false);
  const [mapMode, setMapMode] = useState<'dark' | 'light' | 'satellite' | 'street'>('dark');
  const [mapReady, setMapReady] = useState<boolean>(false);

  // States for user location beacon on the map
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState<boolean>(false);
  const [locError, setLocError] = useState<string | null>(null);

  // Google Maps Style Features state
  const [clickedLoc, setClickedLoc] = useState<SelectedMapLocation | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeTarget, setRouteTarget] = useState<SelectedMapLocation | null>(null);
  const [routingLoading, setRoutingLoading] = useState<boolean>(false);
  
  // Inline reporter inside details sidebar
  const [showReportingForm, setShowReportingForm] = useState<boolean>(false);
  const [reportTitle, setReportTitle] = useState<string>('');
  const [reportCategory, setReportCategory] = useState<IssueCategory>('road');
  const [reportSeverity, setReportSeverity] = useState<SeverityLevel>('medium');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | any>(null); // any for cluster group
  const heatLayerRef = useRef<L.Layer | any>(null); // any for heat layer
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Refs for navigation route visual overlay
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeStartMarkerRef = useRef<L.Marker | null>(null);
  const routeEndMarkerRef = useRef<L.Marker | null>(null);
  const tempPinRef = useRef<L.Marker | null>(null);

  // Geolocation trigger
  const fetchMyLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    setLocLoading(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLoc({ lat: latitude, lng: longitude });
        
        try {
          // Perform reverse geocoding to resolve city and area names
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.address) {
              const extractedCity = data.address.city || 
                                    data.address.town || 
                                    data.address.municipality || 
                                    data.address.city_district || 
                                    data.address.village || 
                                    data.address.suburb || 
                                    data.address.state || 
                                    'Unknown City';

              const extractedArea = data.address.suburb || 
                                    data.address.neighbourhood || 
                                    data.address.residential || 
                                    data.address.subdistrict || 
                                    'Local Area';

              // Call backend to seed realistic local issues if this is a newly detected city
              const seedRes = await fetch('/api/issues/seed-local', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  lat: latitude,
                  lng: longitude,
                  city: extractedCity,
                  area: extractedArea
                })
              });

              if (seedRes.ok) {
                if (onLocationResolved) {
                  onLocationResolved(extractedCity, extractedArea);
                }
              } else {
                if (onLocationResolved) {
                  onLocationResolved(extractedCity, extractedArea);
                }
              }
            }
          }
        } catch (err) {
          console.error("Map reverse geocoding/seeding failed:", err);
          // Fallback if network is offline or Nominatim fails
          if (onLocationResolved) {
            onLocationResolved("Unknown City", "Local Area");
          }
        }

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

    // Default map coordinates center on New Delhi, India
    const map = L.map(mapContainerRef.current, {
      center: [28.6186, 77.1557],
      zoom: 12,
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

  // 1.1 Trigger geolocation on mount automatically so the app is immediately localized
  useEffect(() => {
    if (mapReady) {
      fetchMyLocation();
    }
  }, [mapReady]);

  // 1.2 Dynamic Map Style/Mode Swapping Effect
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

  // 1.3 Handle Arbitrary Map Clicks (Google Maps Style)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Stop routing display and reset form
      setRouteData(null);
      setShowReportingForm(false);
      setReportSuccess(false);
      setReportTitle('');
      setReportDescription('');

      setClickedLoc({
        type: 'point',
        lat,
        lng,
        address: 'Resolving address coordinates...'
      });

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        if (res.ok) {
          const data = await res.json();
          const dispName = data.display_name || `Coordinate (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
          
          const resolvedCity = data.address?.city || 
                               data.address?.town || 
                               data.address?.municipality || 
                               data.address?.village || 
                               data.address?.suburb || 
                               'Unknown City';

          const resolvedArea = data.address?.suburb || 
                               data.address?.neighbourhood || 
                               data.address?.residential || 
                               'Local Area';

          setClickedLoc({
            type: 'point',
            lat,
            lng,
            address: dispName,
            city: resolvedCity,
            area: resolvedArea
          });
        } else {
          setClickedLoc({
            type: 'point',
            lat,
            lng,
            address: `Dropped Pin near: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
          });
        }
      } catch (err) {
        setClickedLoc({
          type: 'point',
          lat,
          lng,
          address: `Dropped Pin near: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
        });
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapReady]);

  // 1.4 Handle Temporary Dropped Pin Overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (tempPinRef.current) {
      map.removeLayer(tempPinRef.current);
      tempPinRef.current = null;
    }

    if (clickedLoc && clickedLoc.type === 'point') {
      const pinHtml = `
        <div class="relative w-8 h-8 flex items-center justify-center animate-bounce">
          <div class="absolute -bottom-1 w-2.5 h-1 bg-black/45 rounded-full blur-sm"></div>
          <span class="text-3xl select-none">📍</span>
        </div>
      `;
      const tempIcon = L.divIcon({
        html: pinHtml,
        className: 'temp-dropped-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 28]
      });

      const marker = L.marker([clickedLoc.lat, clickedLoc.lng], { icon: tempIcon }).addTo(map);
      tempPinRef.current = marker;

      // Pan view to dropped pin
      map.setView([clickedLoc.lat, clickedLoc.lng], Math.max(map.getZoom(), 15));
    }
  }, [clickedLoc, mapReady]);

  // 2. Synchronize Map Markers with filtered issues
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing layers
    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (heatmapMode) {
      // True Thermal Heatmap Layer
      const heatPoints = filteredIssues.map(issue => [
        issue.location.lat, 
        issue.location.lng, 
        issue.severity === 'high' ? 1.0 : issue.severity === 'medium' ? 0.6 : 0.3
      ]);
      
      // @ts-ignore
      heatLayerRef.current = L.heatLayer(heatPoints, { 
        radius: 35, 
        blur: 25, 
        maxZoom: 15,
        gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
      }).addTo(map);
      
    } else {
      // Cluster Markers
      // @ts-ignore
      const clusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 50,
      });

      filteredIssues.forEach((issue) => {
        const isSelected = selectedIssueId === issue.id;
        const gradient = getCategoryColor(issue.category);
        const emoji = getCategoryEmoji(issue.category);
        const isHighUrgency = issue.severity === 'high' && issue.status !== 'closed';
        const isActive = issue.status !== 'closed';

        // Custom interactive visual radar pins
        const markerHtml = `
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-lg border-2 text-sm transition-all duration-300 ${
            isSelected 
              ? 'border-indigo-400 scale-125 ring-4 ring-indigo-500/30 z-50' 
              : 'border-white/90 dark:border-slate-800 scale-100 hover:scale-110'
          } bg-gradient-to-br ${gradient}">
            <span class="select-none text-base">${emoji}</span>
            ${issue.status === 'community_verified' || issue.status === 'resolved' ? `
              <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white border border-white z-10">✓</span>
            ` : ''}
            ${issue.escalated ? `
              <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[7px] font-bold text-white border border-white animate-pulse z-10">🚨</span>
            ` : ''}
            ${isHighUrgency ? `
              <div class="absolute inset-0 -m-3 rounded-full bg-red-500/20 animate-ping opacity-60 pointer-events-none"></div>
            ` : ''}
            ${isActive ? `
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-indigo-500/20 bg-indigo-500/5 pointer-events-none animate-sonar-ripple"></div>
            ` : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-map-pin',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([issue.location.lat, issue.location.lng], { icon: customIcon });

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

        marker.on('click', (ev: L.LeafletEvent) => {
          L.DomEvent.stopPropagation(ev);
          onSelectIssue(issue);
          
          setRouteData(null);
          setShowReportingForm(false);
          setReportSuccess(false);

          setClickedLoc({
            type: 'issue',
            lat: issue.location.lat,
            lng: issue.location.lng,
            address: issue.location.address,
            issue
          });
        });

        clusterGroup.addLayer(marker);

        if (isSelected) {
          setTimeout(() => {
            if (!mapRef.current) return;
            map.setView([issue.location.lat, issue.location.lng], Math.max(map.getZoom(), 15));
            try {
              L.popup({
                className: 'custom-leaflet-popup',
                closeButton: false,
              })
              .setLatLng([issue.location.lat, issue.location.lng])
              .setContent(popupContent)
              .openOn(map);
            } catch (e) {
              console.error("Failed to open popup safely on the map:", e);
            }
          }, 100);
        }
      });
      
      map.addLayer(clusterGroup);
      markersLayerRef.current = clusterGroup;
    }
  }, [filteredIssues, selectedIssueId, heatmapMode, onSelectIssue]);

  // Synchronize clickedLoc when selectedIssueId prop changes externally
  useEffect(() => {
    if (selectedIssueId && issues.length > 0) {
      const found = issues.find(i => i.id === selectedIssueId);
      if (found) {
        setClickedLoc({
          type: 'issue',
          lat: found.location.lat,
          lng: found.location.lng,
          address: found.location.address,
          issue: found
        });
      }
    }
  }, [selectedIssueId, issues]);

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

    // Instantly snap view to user's location
    map.setView([userLoc.lat, userLoc.lng], 15);
  }, [userLoc]);

  // 4. Draw Route Polylines & Markers based on RouteData state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Clean up previous route polyline and icons
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    if (routeStartMarkerRef.current) {
      map.removeLayer(routeStartMarkerRef.current);
      routeStartMarkerRef.current = null;
    }
    if (routeEndMarkerRef.current) {
      map.removeLayer(routeEndMarkerRef.current);
      routeEndMarkerRef.current = null;
    }

    if (!routeData) return;

    const solidColor = theme === 'dark' ? '#818cf8' : '#4f46e5';

    // Core driving route polyline
    const polyline = L.polyline(routeData.coordinates, {
      color: solidColor,
      weight: 6,
      opacity: 0.95,
      lineJoin: 'round'
    }).addTo(map);

    routePolylineRef.current = polyline;

    // Add Start and End Pins
    const startCoord = routeData.coordinates[0];
    const endCoord = routeData.coordinates[routeData.coordinates.length - 1];

    const startIconHtml = `
      <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center font-bold text-white text-[10px] scale-110 animate-pulse">S</div>
    `;
    const endIconHtml = `
      <div class="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white shadow-lg flex items-center justify-center font-bold text-white text-[10px] scale-110 animate-pulse">E</div>
    `;

    const startIcon = L.divIcon({
      html: startIconHtml,
      className: 'route-start-pin',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const endIcon = L.divIcon({
      html: endIconHtml,
      className: 'route-end-pin',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    routeStartMarkerRef.current = L.marker(startCoord, { icon: startIcon }).addTo(map);
    routeEndMarkerRef.current = L.marker(endCoord, { icon: endIcon }).addTo(map);

    // Zoom out map to show the entire route path
    map.fitBounds(polyline.getBounds(), {
      padding: [75, 75],
      maxZoom: 16,
      animate: true,
      duration: 1.0
    });

  }, [routeData, mapReady, theme]);

  // Directions Engine routing calculation
  const calculateRoute = async () => {
    if (!clickedLoc) return;
    const endLat = clickedLoc.lat;
    const endLng = clickedLoc.lng;

    // Start coordinates: use current browser GPS coordinate, or center of the map as default fallback
    let startLat = 28.6186;
    let startLng = 77.1557;

    if (userLoc) {
      startLat = userLoc.lat;
      startLng = userLoc.lng;
    } else if (mapRef.current) {
      const center = mapRef.current.getCenter();
      startLat = center.lat;
      startLng = center.lng;
    }

    setRoutingLoading(true);
    try {
      // Fetch dynamic real-time routing path from OSRM driving service
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Route lookup failed');
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route matched by navigation satellites');
      }

      const route = data.routes[0];
      const rawCoords = route.geometry.coordinates;
      const polyCoords = rawCoords.map((c: [number, number]) => [c[1], c[0]] as [number, number]);

      const legSteps = route.legs[0]?.steps || [];
      const formattedSteps = legSteps.map((step: any) => {
        let inst = step.maneuver?.instruction || 'Continue forward';
        const stName = step.name;
        if (stName) {
          inst += ` onto ${stName}`;
        }
        return {
          instruction: inst,
          distance: step.distance || 0
        };
      });

      setRouteData({
        coordinates: polyCoords,
        distance: route.distance,
        duration: route.duration,
        steps: formattedSteps.length > 0 ? formattedSteps : [{ instruction: 'Proceed toward target coordinate destination', distance: route.distance }]
      });
      setRouteTarget(clickedLoc);
    } catch (err) {
      console.warn('Satellite OSRM Routing failed, drawing straight fallback:', err);
      const fallbackCoords: [number, number][] = [
        [startLat, startLng],
        [endLat, endLng]
      ];
      const dist = L.latLng(startLat, startLng).distanceTo(L.latLng(endLat, endLng));
      setRouteData({
        coordinates: fallbackCoords,
        distance: dist,
        duration: dist / 11, // estimate speed at 40km/h (11 m/s)
        steps: [
          { instruction: 'Depart from your starting location', distance: 0 },
          { instruction: `Head directly toward coordinates: ${endLat.toFixed(5)}, ${endLng.toFixed(5)}`, distance: dist }
        ]
      });
      setRouteTarget(clickedLoc);
    } finally {
      setRoutingLoading(false);
    }
  };

  // Inline Civic Report creation handler
  const handleInlineReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clickedLoc) return;
    if (reportDescription.trim().length < 10) {
      alert("Please write a description of at least 10 characters detailing the safety hazard.");
      return;
    }

    setIsSubmittingReport(true);
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reportTitle.trim() || `${reportCategory.toUpperCase()} hazard spotted`,
          description: reportDescription.trim(),
          category: reportCategory,
          severity: reportSeverity,
          location: {
            lat: clickedLoc.lat,
            lng: clickedLoc.lng,
            address: clickedLoc.address || 'Reported Location',
            area: clickedLoc.area || 'Local District',
            city: clickedLoc.city || 'Municipal Region'
          }
        })
      });

      if (response.ok) {
        const newIssue = await response.json();
        setReportSuccess(true);
        
        // Trigger select and map refresh by updating client's issues list automatically
        setTimeout(() => {
          onSelectIssue(newIssue);
          setClickedLoc({
            type: 'issue',
            lat: newIssue.location.lat,
            lng: newIssue.location.lng,
            address: newIssue.location.address,
            issue: newIssue
          });
          setShowReportingForm(false);
          setReportSuccess(false);
          setReportTitle('');
          setReportDescription('');
        }, 1200);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`Failed to file issue: ${errData.error || response.statusText}`);
      }
    } catch (err) {
      console.error('Failed to submit inline report:', err);
      alert('Network error while filing report.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

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

      {/* Map Canvas Stage Area */}
      <div className="relative w-full aspect-[1000/600] min-h-[400px] md:min-h-[500px] bg-[#070913] overflow-hidden select-none">
        
        {/* Leaflet container ref */}
        <div ref={mapContainerRef} className="absolute inset-0 z-0 w-full h-full" />

        {/* Overlaying HUD Grid Lines */}
        <div className="absolute inset-0 pointer-events-none z-10 border border-indigo-500/5 mix-blend-color-dodge bg-grid-pattern opacity-10" />

        {/* Google Maps floating side info drawer */}
        {clickedLoc && (
          <div className={`absolute z-[1001] bottom-4 left-4 right-4 md:bottom-4 md:top-4 md:right-auto md:w-[385px] h-[55%] md:h-auto rounded-2xl border shadow-2xl backdrop-blur-md flex flex-col overflow-hidden transition-all duration-300 animate-fadeIn ${
            theme === 'dark'
              ? 'bg-slate-950/95 border-white/10 text-slate-100'
              : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/50'
          }`}>
            
            {/* Slide Header: Custom SVG visual gradient + icon based on category */}
            <div className={`relative h-24 shrink-0 flex items-end p-4 bg-gradient-to-br ${
              clickedLoc.type === 'issue' && clickedLoc.issue
                ? getCategoryColor(clickedLoc.issue.category)
                : 'from-slate-700 to-slate-900 bg-slate-800'
            }`}>
              {/* Close Button */}
              <button 
                onClick={() => {
                  setClickedLoc(null);
                }}
                className={`absolute top-3 right-3 p-1.5 rounded-full transition-all cursor-pointer border ${
                  theme === 'dark'
                    ? 'bg-black/40 text-white/80 hover:text-white hover:bg-black/60 border-white/10'
                    : 'bg-slate-100/80 text-slate-600 hover:text-slate-850 hover:bg-slate-200 border-slate-300 shadow-sm'
                }`}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="z-10 flex items-center gap-2">
                <span className="text-3xl filter drop-shadow">
                  {clickedLoc.type === 'issue' && clickedLoc.issue
                    ? getCategoryEmoji(clickedLoc.issue.category)
                    : '📍'}
                </span>
                <div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border ${
                    theme === 'dark'
                      ? 'text-white bg-black/40 border-white/10'
                      : 'text-slate-700 bg-slate-100/80 border-slate-300'
                  }`}>
                    {clickedLoc.type === 'issue' && clickedLoc.issue
                      ? clickedLoc.issue.category.toUpperCase()
                      : 'DROPPED PIN'}
                  </span>
                  <h4 className="text-sm font-black text-white filter drop-shadow leading-tight mt-0.5 max-w-[280px] truncate">
                    {clickedLoc.type === 'issue' && clickedLoc.issue
                      ? clickedLoc.issue.title
                      : 'Selected Location'}
                  </h4>
                </div>
              </div>

              {/* Graphic Ambient Mesh overlay */}
              <div className="absolute inset-0 opacity-15 pointer-events-none mix-blend-overlay bg-grid-pattern" />
            </div>

            {/* Slide Content Scrollable viewport */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {!showReportingForm ? (
                <>
                  {/* Address & GPS Coordinate Card */}
                  <div className={`p-3 rounded-xl border space-y-2 ${
                    theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-150'
                  }`}>
                    <p className={`text-xs leading-normal flex items-start gap-1.5 font-medium ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span>{clickedLoc.address}</span>
                    </p>
                    <div className={`flex items-center justify-between border-t pt-2 text-[10px] font-mono ${
                      theme === 'dark' ? 'border-white/5 text-slate-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <span>{clickedLoc.lat.toFixed(6)}, {clickedLoc.lng.toFixed(6)}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${clickedLoc.lat}, ${clickedLoc.lng}`);
                          alert("Coordinates copied to clipboard!");
                        }}
                        className={`font-bold flex items-center gap-1 cursor-pointer ${
                          theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-750'
                        }`}
                      >
                        <Share2 className="w-3 h-3" />
                        Copy GPS
                      </button>
                    </div>
                  </div>

                  {/* Rating / Meta Info for Issues */}
                  {clickedLoc.type === 'issue' && clickedLoc.issue && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`p-3 rounded-xl border text-center ${
                        theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-150'
                      }`}>
                        <span className={`text-[9px] uppercase tracking-wider font-extrabold block mb-0.5 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                        }`}>SLA Timeline</span>
                        <span className={`text-xs font-bold flex items-center justify-center gap-1 ${
                          theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          {clickedLoc.issue.slaDays} Days Target
                        </span>
                      </div>
                      <div className={`p-3 rounded-xl border text-center ${
                        theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-150'
                      }`}>
                        <span className={`text-[9px] uppercase tracking-wider font-extrabold block mb-0.5 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                        }`}>Community Score</span>
                        <span className={`text-xs font-bold ${
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                        }`}>
                          {clickedLoc.issue.upvotes - clickedLoc.issue.downvotes} Net Votes
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Core Description Text */}
                  {clickedLoc.type === 'issue' && clickedLoc.issue && (
                    <div className="space-y-1">
                      <h5 className={`text-[10px] uppercase tracking-wider font-bold ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`}>Problem Description</h5>
                      <p className={`text-xs leading-relaxed p-3 rounded-xl border ${
                        theme === 'dark' ? 'text-slate-300 bg-white/5 border-white/5' : 'text-slate-700 bg-slate-50 border-slate-150'
                      }`}>
                        {clickedLoc.issue.description}
                      </p>
                    </div>
                  )}

                  {/* Routing results overview */}
                  {routeData && (
                    <div className={`p-3 rounded-xl border space-y-2 animate-fadeIn ${
                      theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-[9px] uppercase tracking-widest font-black ${
                            theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                          }`}>Estimated Route</p>
                          <p className={`text-sm font-extrabold flex items-center gap-1.5 mt-0.5 ${
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          }`}>
                            <Navigation className={`w-4 h-4 fill-indigo-400 animate-pulse ${
                              theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                            }`} />
                            <span>{(routeData.distance / 1000).toFixed(2)} km • {Math.round(routeData.duration / 60)} mins</span>
                          </p>
                        </div>
                        <button 
                          onClick={() => setRouteData(null)}
                          className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/30'
                              : 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'
                          }`}
                        >
                          Clear Route
                        </button>
                      </div>

                      {/* Turn by turn panel */}
                      <div className={`max-h-40 overflow-y-auto border-t pt-2 mt-2 space-y-2 text-[11px] font-medium font-sans custom-scrollbar ${
                        theme === 'dark' ? 'border-indigo-500/15 text-slate-300' : 'border-indigo-200 text-slate-600'
                      }`}>
                        <p className={`font-bold text-[9px] flex items-center gap-1 uppercase tracking-wider mb-1 ${
                          theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'
                        }`}>
                          Navigation Steps
                        </p>
                        {routeData.steps.map((step, idx) => (
                          <div key={idx} className={`flex gap-2 items-start leading-normal p-1 rounded transition-colors ${
                            theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-indigo-100/50'
                          }`}>
                            <span className={`font-mono font-bold text-[9px] mt-0.5 shrink-0 ${
                              theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                            }`}>#{idx + 1}</span>
                            <div className="flex-1">
                              <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{step.instruction}</p>
                              {step.distance > 0 && (
                                <p className={`text-[9px] font-mono mt-0.5 ${
                                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  for {step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Primary Google Maps-style Actions Toolbar */}
                  <div className="flex flex-col gap-2 pt-2">
                    
                    {/* Get Directions Button */}
                    <button
                      onClick={calculateRoute}
                      disabled={routingLoading}
                      className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
                    >
                      {routingLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Navigation className="w-4 h-4 fill-white" />
                      )}
                      <span>{routingLoading ? "Routing Satellite GPS..." : "Get Route Directions"}</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Left: Vote support / Report */}
                      {clickedLoc.type === 'issue' && clickedLoc.issue ? (
                        <button
                          onClick={() => {
                            if (onVoteIssue && clickedLoc.issue) {
                              onVoteIssue(clickedLoc.issue.id, 'valid');
                              // optimistic upvote increment for direct UI response
                              setClickedLoc(prev => {
                                if (prev && prev.issue) {
                                  return {
                                    ...prev,
                                    issue: {
                                      ...prev.issue,
                                      upvotes: prev.issue.upvotes + 1
                                    }
                                  };
                                }
                                  return prev;
                              });
                            }
                          }}
                          className={`py-2.5 px-3 rounded-xl text-[10px] font-black tracking-wider uppercase border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                          Upvote Valid
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowReportingForm(true)}
                          className={`py-2.5 px-3 rounded-xl text-[10px] font-black tracking-wider uppercase border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                              : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
                          Report Issue
                        </button>
                      )}

                      {/* Right: Close or secondary details */}
                      <button
                        onClick={() => {
                          setClickedLoc(null);
                        }}
                        className={`py-2.5 px-3 rounded-xl text-[10px] font-black tracking-wider uppercase border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        Dismiss Pin
                      </button>
                    </div>

                  </div>

                  {/* SLA Timeline flow tracker */}
                  {clickedLoc.type === 'issue' && clickedLoc.issue && (
                    <div className={`pt-2 border-t space-y-3 ${
                      theme === 'dark' ? 'border-white/5' : 'border-slate-200'
                    }`}>
                      <h5 className={`text-[10px] uppercase tracking-wider font-bold ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`}>Resolution Blueprint Pipeline</h5>
                      <div className={`flex items-center justify-between text-[10px] font-semibold px-1 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            ['reported', 'ai_verified', 'community_verified', 'assigned', 'in_progress', 'resolved', 'closed'].includes(clickedLoc.issue.status)
                              ? 'bg-emerald-500 text-white'
                              : theme === 'dark' ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'
                          }`}>1</span>
                          <span>Filed</span>
                        </div>
                        <span className={`h-0.5 flex-1 mx-2 -mt-4 ${
                          theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'
                        }`} />
                        <div className="flex flex-col items-center gap-1">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            ['ai_verified', 'community_verified', 'assigned', 'in_progress', 'resolved', 'closed'].includes(clickedLoc.issue.status)
                              ? 'bg-emerald-500 text-white'
                              : theme === 'dark' ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'
                          }`}>2</span>
                          <span>Verified</span>
                        </div>
                        <span className={`h-0.5 flex-1 mx-2 -mt-4 ${
                          theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'
                        }`} />
                        <div className="flex flex-col items-center gap-1">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            ['assigned', 'in_progress', 'resolved', 'closed'].includes(clickedLoc.issue.status)
                              ? 'bg-emerald-500 text-white'
                              : theme === 'dark' ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'
                          }`}>3</span>
                          <span>Dispatched</span>
                        </div>
                        <span className={`h-0.5 flex-1 mx-2 -mt-4 ${
                          theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'
                        }`} />
                        <div className="flex flex-col items-center gap-1">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            ['resolved', 'closed'].includes(clickedLoc.issue.status)
                              ? 'bg-emerald-500 text-white'
                              : theme === 'dark' ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'
                          }`}>4</span>
                          <span>Resolved</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Inline Report Issue Form */
                <form onSubmit={handleInlineReportSubmit} className="space-y-4 animate-fadeIn">
                  <div className={`flex items-center justify-between border-b pb-2 mb-2 ${
                    theme === 'dark' ? 'border-white/5' : 'border-slate-200'
                  }`}>
                    <h5 className={`text-xs font-black flex items-center gap-1.5 uppercase tracking-widest ${
                      theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                    }`}>
                      <PlusCircle className="w-4 h-4" />
                      Report Civic Hazard
                    </h5>
                    <button 
                      type="button" 
                      onClick={() => setShowReportingForm(false)}
                      className={`text-[10px] font-bold cursor-pointer transition-colors ${
                        theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>

                  {reportSuccess ? (
                    <div className="p-6 text-center space-y-3 flex flex-col items-center justify-center h-48 animate-scaleIn">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
                        <CheckCircle className="w-6 h-6 animate-pulse" />
                      </div>
                      <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Issue Registered!</h4>
                      <p className={`text-[11px] leading-normal ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        Filing report coordinates to tactical database, initializing automated municipal routing...
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className={`text-[10px] uppercase tracking-wider font-bold block ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                        }`}>Issue Title</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Broken pavement tile, water pipe leak"
                          value={reportTitle}
                          onChange={(e) => setReportTitle(e.target.value)}
                          className={`w-full text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border ${
                            theme === 'dark' 
                              ? 'bg-slate-900 border-white/10 text-white' 
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className={`text-[10px] uppercase tracking-wider font-bold block ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                          }`}>Category</label>
                          <select 
                            value={reportCategory}
                            onChange={(e) => setReportCategory(e.target.value as IssueCategory)}
                            className={`w-full text-xs px-2 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border cursor-pointer ${
                              theme === 'dark' 
                                ? 'bg-slate-900 border-white/10 text-white' 
                                : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <option value="road" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-850'}>🚧 Road Damage</option>
                            <option value="garbage" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-850'}>🚮 Garbage Overflow</option>
                            <option value="water" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-850'}>💧 Water Leakage</option>
                            <option value="streetlight" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-850'}>💡 Streetlight Out</option>
                            <option value="safety" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-855'}>🚨 Public Safety</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className={`text-[10px] uppercase tracking-wider font-bold block ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                          }`}>Severity</label>
                          <select 
                            value={reportSeverity}
                            onChange={(e) => setReportSeverity(e.target.value as SeverityLevel)}
                            className={`w-full text-xs px-2 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border cursor-pointer ${
                              theme === 'dark' 
                                ? 'bg-slate-900 border-white/10 text-white' 
                                : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <option value="low" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-850'}>🟢 Low Urgency</option>
                            <option value="medium" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-850'}>🟡 Medium Urgency</option>
                            <option value="high" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-850'}>🔴 High Urgency</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className={`text-[10px] uppercase tracking-wider font-bold block ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                        }`}>Hazard Description</label>
                        <textarea 
                          required
                          minLength={10}
                          rows={4}
                          placeholder="Please provide details describing the safety hazard, infrastructure blockage, or resource leak spotted here..."
                          value={reportDescription}
                          onChange={(e) => setReportDescription(e.target.value)}
                          className={`w-full text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border ${
                            theme === 'dark' 
                              ? 'bg-slate-900 border-white/10 text-white' 
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        />
                        <p className="text-[9px] text-slate-500">Must be at least 10 characters.</p>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingReport}
                        className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-xs tracking-wider uppercase text-white transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-500"
                      >
                        {isSubmittingReport ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Check className="w-4 h-4 text-white" />
                        )}
                        <span>{isSubmittingReport ? "Filing Report..." : "Submit Civic Report"}</span>
                      </button>
                    </>
                  )}
                </form>
              )}

            </div>
          </div>
        )}

        {/* Compact Floating Active Route Navigation HUD (When panel is closed but route is active) */}
        {!clickedLoc && routeData && (
          <div className={`absolute z-30 bottom-4 left-4 right-4 md:right-auto md:w-[350px] p-4 rounded-2xl border shadow-xl backdrop-blur-md flex flex-col gap-3 animate-fadeIn ${
            theme === 'dark'
              ? 'bg-[#0a0c14]/95 border-white/10 text-slate-100 shadow-indigo-950/20'
              : 'bg-white/95 border-slate-200 text-slate-850 shadow-slate-200/50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl flex items-center justify-center ${
                  theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-50'
                }`}>
                  <Navigation className="w-4 h-4 text-indigo-500 fill-indigo-500 animate-pulse" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-black text-indigo-500">Navigation Active</p>
                  <p className={`text-xs font-black mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                    {(routeData.distance / 1000).toFixed(2)} km • {Math.round(routeData.duration / 60)} mins
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRouteData(null);
                  setRouteTarget(null);
                }}
                className={`p-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                    : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                }`}
                title="End navigation and clear route"
              >
                Clear
              </button>
            </div>

            {routeTarget && (
              <div className={`p-2 rounded-lg border text-[10px] ${
                theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'
              }`}>
                <span className="font-bold uppercase tracking-wider text-[8px] block mb-0.5">Destination</span>
                <span className="truncate block font-medium">{routeTarget.address}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (routeTarget) {
                  setClickedLoc(routeTarget);
                }
              }}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] tracking-wider uppercase transition-all flex items-center justify-center gap-1 cursor-pointer border border-indigo-500 shadow-md shadow-indigo-500/10"
            >
              Show Navigation Steps
            </button>
          </div>
        )}

        {/* Floating GPS Location Widget */}
        <div className="absolute top-4 left-4 z-30 flex flex-col gap-2 max-w-[280px]">
          <button
            onClick={fetchMyLocation}
            disabled={locLoading}
            className={`p-2.5 rounded-xl border font-bold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md ${
              userLoc 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-emerald-500/5 hover:bg-emerald-500/25'
                : theme === 'dark'
                  ? 'bg-[#0a0c14]/90 border-white/10 text-white hover:bg-white/10'
                  : 'bg-white/95 border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm'
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
            <div className={`p-2.5 rounded-xl text-[10px] shadow-md leading-tight backdrop-blur-sm animate-fadeIn border ${
              theme === 'dark'
                ? 'bg-[#0a0c14]/95 border-emerald-500/25 text-emerald-400'
                : 'bg-white/95 border-emerald-200 text-emerald-700 shadow-sm'
            }`}>
              <p className={`font-bold uppercase tracking-wider text-[8px] mb-0.5 ${
                theme === 'dark' ? 'text-emerald-500' : 'text-emerald-600'
              }`}>Your Radar Coordinate</p>
              <p className="font-mono">{userLoc.lat.toFixed(5)}, {userLoc.lng.toFixed(5)}</p>
              <p className={`text-[8px] mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                You are live on the tactical grid.
              </p>
            </div>
          )}

          {locError && (
            <div className={`p-3 rounded-xl text-[10px] shadow-md leading-normal backdrop-blur-sm animate-fadeIn border ${
              theme === 'dark'
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm'
            }`}>
              <p className={`font-bold uppercase tracking-wider text-[8px] mb-1 ${
                theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
              }`}>GPS Lock Issue</p>
              <p>{locError}</p>
            </div>
          )}
        </div>

        {/* Floating Map Mode Selector (Top Right) */}
        <div className={`absolute top-4 right-4 z-30 flex gap-1 p-1 rounded-xl backdrop-blur-md shadow-xl border ${
          theme === 'dark'
            ? 'bg-[#0a0c14]/90 border-white/10'
            : 'bg-white/95 border-slate-200'
        }`}>
          <button
            onClick={() => setMapMode('dark')}
            aria-label="Tactical Dark Mode"
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mapMode === 'dark'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
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
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
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
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
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
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Detailed Standard Street Map"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Street</span>
          </button>
        </div>

        {/* Legend Panel */}
        <div className={`absolute bottom-3 right-3 p-3.5 rounded-xl backdrop-blur-md shadow-lg text-[10px] pointer-events-none z-30 border ${
          theme === 'dark'
            ? 'bg-[#0a0c14]/90 border-white/10 text-gray-300'
            : 'bg-white/95 border-slate-200 text-slate-600 shadow-slate-200/50'
        }`}>
          <div className={`font-bold mb-1.5 flex items-center gap-1 uppercase tracking-wider text-[9px] ${
            theme === 'dark' ? 'text-white' : 'text-slate-800'
          }`}>
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            Legend
          </div>
          <div className={`grid grid-cols-2 gap-x-4 gap-y-1.5 ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <span>⚠️ Road</span>
            <span>🗑️ Waste</span>
            <span>🚰 Water Leak</span>
            <span>💡 Lighting</span>
            <span>🚨 Safety</span>
            <span className="text-blue-500 font-medium">✓ Verified</span>
          </div>
        </div>

      </div>
    </div>
  );
}
