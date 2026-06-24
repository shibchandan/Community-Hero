/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Issue, IssueCategory, SeverityLevel } from '../types';
import { Camera, MapPin, Sparkles, AlertTriangle, Building, HelpCircle, Loader2, RefreshCw } from 'lucide-react';

interface IssueReporterProps {
  onIssueReported: (issue: Issue) => void;
  activeArea: string;
}

// Predefined, beautiful seed presets that developers can click to instantly test the Computer Vision AI
const IMAGE_PRESETS = [
  {
    name: 'Asphalt Pothole',
    url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=400&q=80',
    description: 'A deep fissure on standard asphalt road with crumbling margins.',
    category: 'road'
  },
  {
    name: 'Overflowing Dumpster',
    url: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=400&q=80',
    description: 'Sanitation bin completely full with plastic and organic spillover.',
    category: 'garbage'
  },
  {
    name: 'Street Water Burst',
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80',
    description: 'Subterranean mains leaking water directly onto sidewalk cobblestone.',
    category: 'water'
  },
  {
    name: 'Unlit Dark Corridor',
    url: 'https://images.unsplash.com/photo-1508847154043-be12a3b64ea6?auto=format&fit=crop&w=400&q=80',
    description: 'Unlit pedestrian walking path near dense neighborhood shrubs.',
    category: 'safety'
  }
];

export default function IssueReporter({ onIssueReported, activeArea }: IssueReporterProps) {
  const [description, setDescription] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customImageBase64, setCustomImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Manual override states (if user wants to tweak before submitting)
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [category, setCategory] = useState<IssueCategory>('road');
  const [severity, setSeverity] = useState<SeverityLevel>('medium');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('850 Valencia St, San Francisco, CA 94110');

  // Both Location Options (Auto GPS vs. Manual)
  const [locationMode, setLocationMode] = useState<'auto' | 'manual'>('manual');
  const [lat, setLat] = useState<number>(37.7649);
  const [lng, setLng] = useState<number>(-122.4194);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const enableAutoLocation = () => {
    setLocationMode('auto');
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        setAddress(`Device GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setGeoLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        let errorMsg = "Unable to fetch location.";
        if (err.code === 1) {
          errorMsg = "Location permission denied. Please open the app in a new tab using the icon at the top-right of your preview, or grant location permissions in your browser's address bar.";
        } else if (err.code === 2) {
          errorMsg = "Device location unavailable. Please check your system location settings or try a different device.";
        } else if (err.code === 3) {
          errorMsg = "Location request timed out. Please try again or switch to the 'Manual Landmark' option.";
        } else {
          errorMsg = "Browser blocked location within the iframe preview. Open in a new tab to bypass.";
        }
        setGeoError(errorMsg);
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Simulate converting image to base64 for the custom uploads
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPreset(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getBase64FromUrl = async (url: string): Promise<string> => {
    // Since unsplash images will have CORS, we can send the url to backend or let backend fetch.
    // However, to make it perfectly robust and fast, our backend accepts URLs or base64.
    // Let's just pass the URL as a string directly, or mock image if CORS prevents client-side fetching.
    // In our backend, we check if the image is a base64 or standard string URL. If it's unsplash, we fetch or use mock heuristics.
    return url;
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a description of the issue.');
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStep('Activating AI computer vision models...');

    // Simulate stepping through analysis to give a highly premium sci-fi AI feel (matching screenshots)
    const steps = [
      'Scanning image pixels for structural anomalies...',
      'Running multi-label categorization classifiers...',
      'Estimating neighborhood risk density scores...',
      'Querying Gemini 3.5 Civic Router...',
      'Mapping responsible municipal service department...'
    ];

    let currentStepIndex = 0;
    const stepInterval = setInterval(() => {
      if (currentStepIndex < steps.length) {
        setLoadingStep(steps[currentStepIndex]);
        currentStepIndex++;
      }
    }, 1200);

    try {
      let imagePayload = '';
      if (selectedPreset !== null) {
        imagePayload = IMAGE_PRESETS[selectedPreset].url;
      } else if (customImageBase64) {
        imagePayload = customImageBase64;
      }

      // Determine final coordinates based on locationMode
      let finalLat = lat;
      let finalLng = lng;

      if (locationMode === 'manual') {
        // If they have manual but left it at defaults, randomize slightly so it plots nicely in SF SOMA/Mission
        if (lat === 37.7649 && lng === -122.4194) {
          const randomOffsetLat = (Math.random() - 0.5) * 0.015;
          const randomOffsetLng = (Math.random() - 0.5) * 0.015;
          finalLat = 37.7649 + randomOffsetLat;
          finalLng = -122.4194 + randomOffsetLng;
        }
      }

      const payload = {
        description,
        category: selectedPreset !== null ? IMAGE_PRESETS[selectedPreset].category : category,
        severity,
        image: imagePayload,
        location: {
          lat: finalLat,
          lng: finalLng,
          address: address,
          area: activeArea || 'Mission District'
        }
      };

      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to submit report.');
      }

      const reportedIssue: Issue = await response.json();
      onIssueReported(reportedIssue);
      
      // Reset form
      setDescription('');
      setSelectedPreset(null);
      setCustomImageBase64(null);
      setTitle('');

    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || 'AI service took too long or failed. Please check your connectivity and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-6 rounded-2xl bento-card shadow-2xl transition-all duration-300">
      
      {/* Title Header */}
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold font-display text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
          AI-Powered Civic Reporter
        </h2>
        <p className="text-sm text-gray-400">
          Upload a photo or write a description. Community Hero AI will automatically classify, check for duplicates, and assign the proper SLA department.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="relative flex items-center justify-center w-24 h-24 mb-6">
            {/* Double radar circles */}
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-4 border-violet-500/30 animate-pulse" />
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
          </div>
          <h4 className="text-base font-bold text-white animate-pulse font-display">
            Analyzing Issue Landmarks
          </h4>
          <p className="text-xs text-gray-400 mt-2 max-w-sm">
            {loadingStep}
          </p>
        </div>
      ) : (
        <form onSubmit={handleReportSubmit} className="space-y-6">
          
          {/* Preset Visuals Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              1. Tap a Photo Preset to Test (or Upload Below)
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {IMAGE_PRESETS.map((preset, idx) => (
                <div
                  key={preset.name}
                  onClick={() => {
                    setSelectedPreset(idx);
                    setCustomImageBase64(null);
                    // Automatically add a realistic description to match the test preset
                    if (!description) {
                      setDescription(`Detected an urgent ${preset.name.toLowerCase()} here. ${preset.description}`);
                    }
                  }}
                  className={`relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-300 ${
                    selectedPreset === idx
                      ? 'border-indigo-500 scale-102 shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/10'
                      : 'border-transparent hover:border-white/20'
                  }`}
                >
                  <img src={preset.url} alt={preset.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-2.5">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{preset.name}</span>
                    <span className="text-[8px] text-gray-300 line-clamp-1 mt-0.5">{preset.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom File Upload Drag Box */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">or upload custom hazard photo</span>
              {customImageBase64 && (
                <button
                  type="button"
                  onClick={() => setCustomImageBase64(null)}
                  className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Clear Upload
                </button>
              )}
            </div>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />

            {!customImageBase64 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white/5 hover:bg-white/10 transition-all"
              >
                <Camera className="w-6 h-6 text-gray-400 mb-2" />
                <span className="text-xs text-gray-400">Click to upload photo or capture using phone camera</span>
              </div>
            ) : (
              <div className="relative w-full aspect-video md:aspect-[2.5/1] rounded-xl overflow-hidden border border-white/10 bg-black">
                <img src={customImageBase64} alt="Custom hazard" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 px-2.5 py-1 rounded bg-black/60 text-[10px] text-white backdrop-blur-md">
                  ✓ Custom Image Loaded
                </div>
              </div>
            )}
          </div>

          {/* Issue Description Area */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              2. Describe the Issue Details
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g. The water pressure burst through the pavement. There's significant flooding on the corner of 16th and Valencia Street, making it impossible to cross safely. Water is entering basement parking of nearby apartments."
              rows={4}
              className="w-full text-sm px-4 py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Geolocation & Location Choice Section */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
              3. Set Hazard Location (Device GPS vs Manual Landmark)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Auto GPS Option */}
              <button
                type="button"
                onClick={enableAutoLocation}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-24 cursor-pointer ${
                  locationMode === 'auto'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-md shadow-indigo-500/5'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-white">
                    <MapPin className={`w-4 h-4 ${locationMode === 'auto' ? 'text-indigo-400 animate-pulse' : 'text-gray-400'}`} />
                    Auto-Detect GPS
                  </span>
                  {geoLoading && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
                </div>
                <div>
                  <p className="text-[10px] text-gray-300">
                    {locationMode === 'auto' && !geoLoading ? `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Uses your browser's actual real-time device location."}
                  </p>
                </div>
              </button>

              {/* Manual/Simulated option */}
              <button
                type="button"
                onClick={() => {
                  setLocationMode('manual');
                  setLat(37.7649);
                  setLng(-122.4194);
                  setAddress('850 Valencia St, San Francisco, CA 94110');
                  setGeoError(null);
                }}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-24 cursor-pointer ${
                  locationMode === 'manual'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-md shadow-indigo-500/5'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-white">
                  <Building className="w-4 h-4 text-gray-400" />
                  Manual Landmark
                </span>
                <p className="text-[10px] text-gray-300 truncate">
                  {locationMode === 'manual' ? address : 'Enter custom address & coordinates manually.'}
                </p>
              </button>
            </div>

            {/* Geolocation Warning/Info Banner */}
            {geoError && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed flex items-start gap-2.5 animate-fadeIn">
                <span className="text-sm mt-0.5">⚠️</span>
                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-amber-400 mb-0.5">Location Access Notice</p>
                  <p>{geoError}</p>
                </div>
              </div>
            )}

            {/* Custom Location Input Fields (visible in both but tailored) */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 animate-fadeIn text-gray-300">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Landmark / Street Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={locationMode === 'auto' ? "E.g. Near My Current Position" : "E.g. 850 Valencia St, San Francisco, CA"}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-white/10 bg-slate-950 text-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">
                    Latitude {locationMode === 'auto' ? '(GPS Auto)' : '(Manual)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    disabled={locationMode === 'auto'}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 37.7649)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-white/10 bg-slate-950 text-white focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">
                    Longitude {locationMode === 'auto' ? '(GPS Auto)' : '(Manual)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    disabled={locationMode === 'auto'}
                    onChange={(e) => setLng(parseFloat(e.target.value) || -122.4194)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-white/10 bg-slate-950 text-white focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Category / Override Toggle */}
          <div className="border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setShowOverrideForm(!showOverrideForm)}
              className="text-xs text-indigo-400 font-medium hover:underline flex items-center gap-1"
            >
              ⚙️ {showOverrideForm ? 'Hide advanced classification overrides' : 'Show advanced classification overrides (Optional)'}
            </button>

            {showOverrideForm && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-white/5 border border-white/10 animate-fadeIn text-gray-300">
                
                {/* Back-up Category */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 font-sans">Fallback Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IssueCategory)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-white/10 bg-slate-950 text-white font-sans"
                  >
                    <option value="road">Road Damage (potholes)</option>
                    <option value="garbage">Garbage Overflow</option>
                    <option value="water">Water Leakage</option>
                    <option value="streetlight">Streetlight failure</option>
                    <option value="safety">Public Safety / Dark alley</option>
                  </select>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 font-sans">Estimated Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-white/10 bg-slate-950 text-white font-sans"
                  >
                    <option value="low">Low Impact</option>
                    <option value="medium">Medium Hazard</option>
                    <option value="high">Critical Risk (Life/Accident Hazard)</option>
                  </select>
                </div>

                <div className="flex items-center text-[10px] text-gray-400 gap-1.5 md:col-span-2 mt-1 font-sans">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  Your device coordinates will map your report directly onto the interactive real-time geolocation radar.
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-3 px-6 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Analyze & Report with Community Hero AI
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
