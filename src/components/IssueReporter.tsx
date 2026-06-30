/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Issue, IssueCategory, SeverityLevel, User } from '../types';
import { 
  Camera, MapPin, Sparkles, AlertTriangle, Building, 
  HelpCircle, Loader2, RefreshCw, ArrowLeft, Phone, 
  Mail, Ticket, Calendar, User as UserIcon, Check, 
  ChevronRight, ArrowRight, Shield, Volume2, Info, MessageSquare
} from 'lucide-react';

interface IssueReporterProps {
  onIssueReported: (issue: Issue) => void;
  activeArea: string;
  issues?: Issue[];
  currentUser?: User | null;
  theme?: 'dark' | 'light';
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
    url: 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&w=400&q=80',
    description: 'Subterranean mains leaking water directly onto sidewalk cobblestone.',
    category: 'water'
  },
  {
    name: 'Excessive Water on Road',
    url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=400&q=80',
    description: 'Excessive water in road portion creating traffic blockages and hydroplaning hazards.',
    category: 'water'
  },
  {
    name: 'Unlit Dark Corridor',
    url: 'https://images.unsplash.com/photo-1508847154043-be12a3b64ea6?auto=format&fit=crop&w=400&q=80',
    description: 'Unlit pedestrian walking path near dense neighborhood shrubs.',
    category: 'safety'
  }
];

export default function IssueReporter({ 
  onIssueReported, 
  activeArea, 
  issues = [], 
  currentUser, 
  theme = 'dark' 
}: IssueReporterProps) {
  // Screen/Mode Control
  // 'need_help' | 'report_form' | 'make_call' | 'write_mail' | 'my_tickets'
  const [mode, setMode] = useState<'need_help' | 'report_form' | 'make_call' | 'write_mail' | 'my_tickets'>('need_help');

  // Interactive Sub-states
  const [activeCall, setActiveCall] = useState<{ name: string; number: string; active: boolean } | null>(null);
  const [callTimer, setCallTimer] = useState<number>(0);
  const [callInterval, setCallInterval] = useState<any>(null);
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailCategory, setEmailCategory] = useState('general');

  // Existing Report Form States
  const [description, setDescription] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customImageBase64, setCustomImageBase64] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisFeedback, setImageAnalysisFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Manual override states (if user wants to tweak before submitting)
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [category, setCategory] = useState<IssueCategory>('road');
  const [severity, setSeverity] = useState<SeverityLevel>('medium');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('Connaught Place Outer Circle, New Delhi, Delhi 110001');
  const [area, setArea] = useState('Connaught Place');
  const [city, setCity] = useState('New Delhi');

  // Location Options (Auto GPS vs. Manual)
  const [locationMode, setLocationMode] = useState<'auto' | 'manual'>('manual');
  const [lat, setLat] = useState<number>(28.6304);
  const [lng, setLng] = useState<number>(77.2177);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter actual user tickets from issues list
  const userTickets = issues.filter(issue => 
    currentUser ? (issue.reportedBy === currentUser.id || issue.reportedByName === currentUser.name) : false
  );

  // Most recent user ticket (if any exists)
  const latestTicket = userTickets.length > 0 ? userTickets[userTickets.length - 1] : null;

  // Handle dial/call simulation
  const startCallSimulation = (name: string, number: string) => {
    if (callInterval) clearInterval(callInterval);
    setCallTimer(0);
    setActiveCall({ name, number, active: true });
    
    const interval = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);
    setCallInterval(interval);
  };

  const stopCallSimulation = () => {
    if (callInterval) {
      clearInterval(callInterval);
      setCallInterval(null);
    }
    setActiveCall(null);
    setCallTimer(0);
  };

  // Format call timer
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setEmailSubmitted(true);
    setTimeout(() => {
      setEmailSubmitted(false);
      setEmailSubject('');
      setEmailBody('');
      setMode('need_help');
    }, 3500);
  };

  const enableAutoLocation = () => {
    setLocationMode('auto');
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          if (data && data.address) {
            setAddress(data.display_name || `Device GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            
            // Automatically extract actual city name (e.g., Bidhannagar or Kolkata)
            const extractedCity = data.address.city || 
                                  data.address.town || 
                                  data.address.municipality || 
                                  data.address.city_district || 
                                  data.address.village || 
                                  data.address.suburb || 
                                  data.address.state || 
                                  'Unknown City';
            setCity(extractedCity);
            
            // Automatically extract suburb / neighborhood
            const extractedArea = data.address.suburb || 
                                  data.address.neighbourhood || 
                                  data.address.residential || 
                                  data.address.subdistrict || 
                                  'Local Area';
            setArea(extractedArea);
          } else {
            setAddress(`Device GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            setCity('Unknown City');
            setArea('Local Area');
          }
        } catch (err) {
          console.error("Reverse geocoding failed", err);
          setAddress(`Device GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          setCity('Unknown City');
          setArea('Local Area');
        }
        setGeoLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        let errorMsg = "Unable to fetch location.";
        if (err.code === 1) {
          errorMsg = "Location permission denied. Please grant location permissions in your browser's address bar.";
        } else if (err.code === 2) {
          errorMsg = "Device location unavailable. Please check your system location settings.";
        } else {
          errorMsg = "Browser blocked location within iframe. Using fallback landmarks.";
        }
        setGeoError(errorMsg);
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const runImageAnalysis = async (imagePayload: string) => {
    setIsAnalyzingImage(true);
    setImageAnalysisFeedback(null);
    setError(null);
    
    try {
      const res = await fetch('/api/gemini/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagePayload })
      });
      
      if (!res.ok) {
        throw new Error('Failed to analyze image with AI');
      }
      
      const data = await res.json();
      
      if (data) {
        if (data.description) setDescription(data.description);
        if (data.category) setCategory(data.category as IssueCategory);
        if (data.severity) setSeverity(data.severity as SeverityLevel);
        if (data.title) setTitle(data.title);
        
        // Auto show overrides to let user verify results
        setShowOverrideForm(true);
        setImageAnalysisFeedback(`Gemini AI Vision successfully parsed: "${data.title}" | Category: ${data.category.toUpperCase()} | Severity: ${data.severity.toUpperCase()}`);
      }
    } catch (err: any) {
      console.error('Error analyzing image:', err);
      setImageAnalysisFeedback('Could not reach Gemini Vision analyzer. Please describe details manually.');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPreset(null);
      setImageAnalysisFeedback(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCustomImageBase64(base64);
        runImageAnalysis(base64);
      };
      reader.readAsDataURL(file);
    }
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

      let finalLat = lat;
      let finalLng = lng;

      if (locationMode === 'manual') {
        if (lat === 28.6304 && lng === 77.2177) {
          const randomOffsetLat = (Math.random() - 0.5) * 0.015;
          const randomOffsetLng = (Math.random() - 0.5) * 0.015;
          finalLat = 28.6304 + randomOffsetLat;
          finalLng = 77.2177 + randomOffsetLng;
        }
      }

      const payload = {
        description,
        category,
        severity,
        image: imagePayload,
        location: {
          lat: finalLat,
          lng: finalLng,
          address,
          area,
          city
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
      
      // Reset form & transition to landing dashboard showing their newly created ticket
      setDescription('');
      setSelectedPreset(null);
      setCustomImageBase64(null);
      setTitle('');
      setMode('need_help');

    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || 'AI service took too long or failed. Please check your connectivity and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render Status Badge matching standard categories
  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; bgDark: string; textDark: string; borderDark: string; bgLight: string; textLight: string; borderLight: string }> = {
      reported: { label: 'Reported', bgDark: 'bg-slate-500/10', textDark: 'text-slate-400', borderDark: 'border-slate-500/20', bgLight: 'bg-slate-200/85', textLight: 'text-slate-800 font-extrabold', borderLight: 'border-slate-300' },
      ai_verified: { label: 'AI Verified', bgDark: 'bg-blue-500/10', textDark: 'text-blue-400', borderDark: 'border-blue-500/20', bgLight: 'bg-blue-200/80', textLight: 'text-blue-950 font-extrabold', borderLight: 'border-blue-300' },
      community_verified: { label: 'Civic Verified', bgDark: 'bg-indigo-500/10', textDark: 'text-indigo-400', borderDark: 'border-indigo-500/20', bgLight: 'bg-indigo-200/80', textLight: 'text-indigo-950 font-extrabold', borderLight: 'border-indigo-300' },
      assigned: { label: 'Assigned', bgDark: 'bg-amber-500/10', textDark: 'text-amber-400', borderDark: 'border-amber-500/30', bgLight: 'bg-amber-200/80', textLight: 'text-amber-950 font-extrabold', borderLight: 'border-amber-300' },
      in_progress: { label: 'In Progress', bgDark: 'bg-orange-500/10', textDark: 'text-orange-400', borderDark: 'border-orange-500/20', bgLight: 'bg-orange-200/80', textLight: 'text-orange-950 font-extrabold', borderLight: 'border-orange-300' },
      resolved: { label: 'Resolved', bgDark: 'bg-emerald-500/10', textDark: 'text-emerald-400', borderDark: 'border-emerald-500/20', bgLight: 'bg-emerald-200/85', textLight: 'text-emerald-950 font-extrabold', borderLight: 'border-emerald-300' },
      closed: { label: 'Closed', bgDark: 'bg-gray-500/10', textDark: 'text-gray-400', borderDark: 'border-gray-500/20', bgLight: 'bg-slate-200', textLight: 'text-slate-700 font-extrabold', borderLight: 'border-slate-300' },
    };

    const s = map[status] || { label: 'Pending', bgDark: 'bg-amber-500/10', textDark: 'text-amber-500', borderDark: 'border-amber-500/30', bgLight: 'bg-amber-100', textLight: 'text-amber-950 font-extrabold', borderLight: 'border-amber-300' };
    return (
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border tracking-wide shadow-xs capitalize ${
        theme === 'dark' 
          ? `${s.bgDark} ${s.textDark} ${s.borderDark}` 
          : `${s.bgLight} ${s.textLight} ${s.borderLight}`
      }`}>
        {s.label}
      </span>
    );
  };

  // Translate categories to human friendly names
  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      road: 'Road Damage',
      garbage: 'Garbage & Sanitation',
      water: 'Water & Leaks',
      streetlight: 'Streetlight Failure',
      safety: 'Public Safety Concern'
    };
    return labels[cat] || cat;
  };

  return (
    <div className={`relative w-full p-6 bento-card transition-all duration-300 ${
      theme === 'dark' ? 'text-white' : 'text-slate-900 font-medium'
    }`}>
      
      {/* ------------------ VIEW 1: NEED HELP DASHBOARD (As shown in screenshot) ------------------ */}
      {mode === 'need_help' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <h2 className={`text-2xl font-black tracking-tight font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Need Help?
              </h2>
              <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                Kindly share your issue or concern, and we'll be glad to help.
              </p>
            </div>
          </div>

          {/* My Previous Ticket Box */}
          <div className="space-y-3">
            <h3 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
              My Previous Ticket
            </h3>

            {latestTicket ? (
              <div className={`p-4 rounded-xl border transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-indigo-950/20 border-indigo-500/30 text-slate-300 shadow-lg shadow-indigo-950/20' 
                  : 'bg-white/60 border-indigo-300/60 text-slate-900 font-medium backdrop-blur-xs'
              }`}>
                <div className="flex items-center justify-between pb-3 border-b border-dashed border-indigo-500/10">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}`}>Complaint No. :</span>
                    <span className="text-xs font-bold font-mono text-indigo-500 dark:text-indigo-400">#{latestTicket.id.substring(0, 6).toUpperCase()}</span>
                  </div>
                  {getStatusBadge(latestTicket.status)}
                </div>

                <div className="mt-3 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <UserIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span>
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}>Assigned To :</span>{' '}
                      <span className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-black'}`}>{latestTicket.department || 'Awaiting Routing Team'}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span>
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}>Assigned Date :</span>{' '}
                      <span className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-black'}`}>
                        {new Date(latestTicket.createdAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })} | {new Date(latestTicket.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* High-fidelity simulated onboarding ticket from screenshot */
              <div className={`p-5 rounded-xl border transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-slate-900/40 border-indigo-500/20 text-slate-300' 
                  : 'bg-white/60 border-sky-300/60 text-slate-900 font-medium backdrop-blur-xs'
              }`}>
                <div className="flex items-center justify-between pb-3 border-b border-dashed border-sky-500/10">
                  <div className="flex items-center gap-1">
                    <span className={`text-[11px] font-extrabold ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700'}`}>Complaint No. :</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-indigo-400 font-mono">#00524</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Pending
                  </span>
                </div>

                <div className="mt-3 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <UserIcon className="w-4 h-4 text-slate-500 dark:text-indigo-400" />
                    <span>
                      <span className={`font-extrabold ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700'}`}>Assigned To :</span>{' '}
                      <span className="font-bold text-slate-900 dark:text-slate-200">Rabindra Kumar Sharma</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-500 dark:text-indigo-400" />
                    <span>
                      <span className={`font-extrabold ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700'}`}>Assigned Date :</span>{' '}
                      <span className="font-bold text-slate-900 dark:text-slate-200">July 29, 2023 | 10:45</span>
                    </span>
                  </div>
                </div>
                
                <div className="mt-3.5 pt-3.5 border-t border-dashed border-indigo-500/10 flex items-center gap-2 text-[10px] text-indigo-400 font-bold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Onboarding demo ticket — Click 'Report Your Problem' to file your first real issue!</span>
                </div>
              </div>
            )}
          </div>

          {/* Grid Selection Area */}
          <div className="space-y-3.5">
            <h3 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
              Complain Your Problem
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Card 1: Report Your Problem */}
              <button
                onClick={() => setMode('report_form')}
                className="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-xl hover:shadow-emerald-500/20 hover:scale-103 transition-all duration-300 text-center cursor-pointer min-h-[140px]"
              >
                <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase mb-1">Report Your</span>
                <span className="text-sm font-black tracking-wide leading-tight">Problem</span>
              </button>

              {/* Card 2: Make A Call */}
              <button
                onClick={() => setMode('make_call')}
                className="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-[#f43f5e] to-[#f97316] text-white shadow-xl hover:shadow-rose-500/20 hover:scale-103 transition-all duration-300 text-center cursor-pointer min-h-[140px]"
              >
                <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase mb-1">Make A</span>
                <span className="text-sm font-black tracking-wide leading-tight">Call</span>
              </button>

              {/* Card 3: Write A Mail */}
              <button
                onClick={() => setMode('write_mail')}
                className="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white shadow-xl hover:shadow-amber-500/20 hover:scale-103 transition-all duration-300 text-center cursor-pointer min-h-[140px]"
              >
                <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase mb-1">Write A</span>
                <span className="text-sm font-black tracking-wide leading-tight">Mail</span>
              </button>

              {/* Card 4: My Tickets */}
              <button
                onClick={() => setMode('my_tickets')}
                className="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#4f46e5] text-white shadow-xl hover:shadow-indigo-500/20 hover:scale-103 transition-all duration-300 text-center cursor-pointer min-h-[140px]"
              >
                <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Ticket className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase mb-1">My</span>
                <span className="text-sm font-black tracking-wide leading-tight">Tickets</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ------------------ VIEW 2: AI-POWERED REPORT FORM (Nested back sub-flow) ------------------ */}
      {mode === 'report_form' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header & Back Arrow */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode('need_help')}
              className={`p-2 rounded-xl transition-all cursor-pointer border ${
                theme === 'dark' 
                  ? 'hover:bg-white/10 text-gray-300 border-white/10 hover:text-white' 
                  : 'hover:bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
              title="Go back to Help Desk"
              aria-label="Back to support landing"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className={`text-xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                AI-Powered Civic Reporter
              </h2>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                Samadhan Setu AI classifies, checks duplicates, and logs your ticket immediately.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-4 border-violet-500/30 animate-pulse" />
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
              </div>
              <h4 className={`text-base font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Analyzing Issue Landmarks
              </h4>
              <p className={`text-xs mt-2 max-w-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-bold'}`}>
                {loadingStep}
              </p>
            </div>
          ) : (
            <form onSubmit={handleReportSubmit} className="space-y-5">
              
              {/* Preset Visuals Selector */}
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                  1. Tap a Photo Preset to Test (or Upload Below)
                </label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {IMAGE_PRESETS.map((preset, idx) => (
                    <div
                      key={preset.name}
                      onClick={() => {
                        setSelectedPreset(idx);
                        setCustomImageBase64(null);
                        runImageAnalysis(preset.url);
                      }}
                      className={`relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-300 ${
                        selectedPreset === idx
                          ? 'border-indigo-500 scale-102 shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/10'
                          : 'border-transparent hover:border-white/20'
                      }`}
                    >
                      <img src={preset.url} alt={preset.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-2">
                        <span className="text-[9px] font-bold text-white uppercase tracking-wider">{preset.name}</span>
                        <span className="text-[7.5px] text-gray-300 line-clamp-1 mt-0.5">{preset.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom File Upload Box */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                    or upload custom hazard photo
                  </span>
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
                    className={`w-full py-5 border border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                      theme === 'dark' 
                        ? 'border-white/10 bg-white/5 hover:bg-white/10' 
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <Camera className={`w-5 h-5 mb-1.5 ${theme === 'dark' ? 'text-gray-400' : 'text-indigo-600'}`} />
                    <span className={`text-xs font-bold ${theme === 'dark' ? 'text-gray-400' : 'text-slate-800'}`}>Click to upload photo or capture using camera</span>
                  </div>
                ) : (
                  <div className="relative w-full aspect-video md:aspect-[3/1] rounded-xl overflow-hidden border border-white/10 bg-black">
                    <img src={customImageBase64} alt="Custom hazard" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 px-2.5 py-1 rounded bg-black/60 text-[10px] text-white backdrop-blur-md">
                      ✓ Custom Image Loaded
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Image Analysis Status */}
              {(isAnalyzingImage || imageAnalysisFeedback) && (
                <div className={`p-4 rounded-xl border flex flex-col gap-2.5 animate-fadeIn ${
                  theme === 'dark' 
                    ? 'bg-indigo-950/20 border-indigo-500/30 text-indigo-300' 
                    : 'bg-indigo-50 border-indigo-100 text-indigo-900'
                }`}>
                  <div className="flex items-center gap-2">
                    {isAnalyzingImage ? (
                      <Loader2 className="w-4.5 h-4.5 text-indigo-500 animate-spin" />
                    ) : (
                      <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                    )}
                    <span className="text-[10px] font-black tracking-wider uppercase font-mono">
                      {isAnalyzingImage ? 'Gemini 3.5 AI Vision analysis in-progress...' : 'Civic AI Vision Diagnostic'}
                    </span>
                  </div>
                  {isAnalyzingImage ? (
                    <p className="text-xs leading-relaxed opacity-85">
                      Extracting spatial geometry, material hazards, and urgency metrics directly from the image pixels...
                    </p>
                  ) : (
                    <p className="text-xs leading-relaxed font-semibold">
                      {imageAnalysisFeedback}
                    </p>
                  )}
                </div>
              )}

              {/* Issue Description Area */}
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                  2. Describe the Issue Details
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g. Large water line leak flooding Karol Bagh sidewalk..."
                  rows={3}
                  className={`w-full text-sm px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                    theme === 'dark' 
                      ? 'border-white/10 bg-slate-950 text-white placeholder-gray-600' 
                      : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* Location Selector */}
              <div className="space-y-2.5">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                  3. Set Location
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={enableAutoLocation}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-20 cursor-pointer ${
                      locationMode === 'auto'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : theme === 'dark'
                          ? 'border-white/10 bg-white/5 text-gray-400'
                          : 'border-slate-300 bg-white shadow-xs text-slate-850'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${theme === 'dark' || locationMode === 'auto' ? 'text-white' : 'text-slate-800'}`}>
                        <MapPin className={`w-3.5 h-3.5 ${locationMode === 'auto' ? 'text-indigo-400 animate-pulse' : theme === 'dark' ? 'text-gray-400' : 'text-indigo-600'}`} />
                        Use Current Location
                      </span>
                      {geoLoading && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
                    </div>
                    <p className="text-[10px] opacity-75 truncate">
                      {locationMode === 'auto' && !geoLoading ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "Extract city, address & suburb from GPS"}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLocationMode('manual');
                      setLat(28.6304);
                      setLng(77.2177);
                      setAddress('Connaught Place Outer Circle, New Delhi, Delhi 110001');
                      setGeoError(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-20 cursor-pointer ${
                      locationMode === 'manual'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : theme === 'dark'
                          ? 'border-white/10 bg-white/5 text-gray-400'
                          : 'border-slate-300 bg-white shadow-xs text-slate-850'
                    }`}
                  >
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${theme === 'dark' || locationMode === 'manual' ? 'text-white' : 'text-slate-800'}`}>
                      <Building className={`w-3.5 h-3.5 ${locationMode === 'manual' ? 'text-indigo-400' : theme === 'dark' ? 'text-gray-400' : 'text-indigo-600'}`} />
                      Manual Input
                    </span>
                    <p className="text-[10px] opacity-75 truncate">
                      {locationMode === 'manual' ? address : 'Type custom street landmark'}
                    </p>
                  </button>
                </div>

                {geoError && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] leading-relaxed flex items-start gap-1.5 animate-fadeIn">
                    <span>⚠️</span>
                    <p>{geoError}</p>
                  </div>
                )}

                {/* Input forms for manual */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${
                  theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className={`block text-[8px] font-black uppercase ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}`}>Street Address</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className={`w-full text-xs px-2.5 py-1.5 mt-0.5 rounded-lg border focus:ring-1 focus:ring-indigo-500 outline-none ${
                          theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[8px] font-black uppercase ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}`}>Sector Area</label>
                      <input
                        type="text"
                        value={activeArea}
                        disabled
                        className={`w-full text-xs px-2.5 py-1.5 mt-0.5 rounded-lg border opacity-60 cursor-not-allowed ${
                          theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Overrides */}
              <div className="border-t border-white/5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOverrideForm(!showOverrideForm)}
                  className="text-[10px] text-indigo-400 font-bold hover:underline"
                >
                  {showOverrideForm ? 'Hide category overrides' : 'Show category overrides (Optional)'}
                </button>

                {showOverrideForm && (
                  <div className="mt-3 grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                    <div>
                      <label className={`block text-[9px] font-bold uppercase mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}`}>Backup Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as IssueCategory)}
                        className={`w-full text-xs px-2 py-1.5 rounded-lg border outline-none ${
                          theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                        }`}
                      >
                        <option value="road" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Road Damage</option>
                        <option value="garbage" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Garbage & Sanitation</option>
                        <option value="water" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Water Leakage</option>
                        <option value="streetlight" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Streetlight failure</option>
                        <option value="safety" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Public Safety Concern</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[9px] font-bold uppercase mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}`}>Estimated Severity</label>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                        className={`w-full text-xs px-2 py-1.5 rounded-lg border outline-none ${
                          theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                        }`}
                      >
                        <option value="low" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Low Impact</option>
                        <option value="medium" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Medium Hazard</option>
                        <option value="high" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Critical Risk (High Danger)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <button
                type="submit"
                className="w-full py-3 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
                Analyze & Report with Samadhan Setu AI
              </button>
            </form>
          )}
        </motion.div>
      )}

      {/* ------------------ VIEW 3: MAKE A CALL (Helpline dial simulation) ------------------ */}
      {mode === 'make_call' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setMode('need_help'); }}
              className={`p-2 rounded-xl transition-all cursor-pointer border ${
                theme === 'dark' 
                  ? 'hover:bg-white/10 text-gray-300 border-white/10 hover:text-white' 
                  : 'hover:bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className={`text-xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Helpline Dispatch Services
              </h2>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                Direct communication channels with city administrators & emergency services.
              </p>
            </div>
          </div>

          {/* List of Emergency Helplines */}
          <div className="space-y-3">
            {[
              {
                name: 'KMC Control Room',
                desc: 'For non-emergency civic requests: potholes, water logging, streetlights, or garbage.',
                number: '1800-345-3375',
                color: 'emerald',
                type: 'tel'
              },
              {
                name: 'KMC WhatsApp Grievance',
                desc: 'Report civic issues directly to Kolkata Municipal Corporation via WhatsApp.',
                number: '+91 8335999111',
                color: 'amber',
                type: 'whatsapp'
              },
              {
                name: 'National Emergency (112)',
                desc: 'Strictly for active fires, structural collapses, and severe safety threats.',
                number: '112',
                color: 'red',
                type: 'tel'
              }
            ].map((hp) => {
              const cleanedNum = hp.number.replace(/[^0-9]/g, '');
              const redirectUrl = hp.type === 'whatsapp' 
                ? `https://wa.me/${cleanedNum}` 
                : `tel:${cleanedNum}`;

              return (
                <div
                  key={hp.name}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/8' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'
                  }`}
                >
                  <div className="flex-1 space-y-2">
                    <div>
                      <h4 className={`text-sm font-black uppercase tracking-wide flex items-center gap-1.5 ${
                        theme === 'dark' ? 'text-white' : 'text-slate-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          hp.color === 'emerald' ? 'bg-emerald-500' : hp.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        {hp.name}
                      </h4>
                      <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                        {hp.desc}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg border ${
                        theme === 'dark' 
                          ? 'bg-slate-950/60 text-indigo-300 border-white/5' 
                          : 'bg-white text-indigo-700 border-slate-200 shadow-sm'
                      }`}>
                        {hp.number}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        hp.type === 'whatsapp' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {hp.type === 'whatsapp' ? 'WhatsApp direct' : 'Toll-free direct'}
                      </span>
                    </div>
                  </div>

                  <a
                    href={redirectUrl}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 hover:scale-[1.02] self-start sm:self-center flex items-center gap-1.5 shadow-md ${
                      hp.color === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10' : hp.color === 'amber' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/10'
                    }`}
                  >
                    {hp.type === 'whatsapp' ? (
                      <>
                        <MessageSquare className="w-3.5 h-3.5" /> Message
                      </>
                    ) : (
                      <>
                        <Phone className="w-3.5 h-3.5" /> Dial Call
                      </>
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ------------------ VIEW 4: WRITE A MAIL (Compose ticket draft) ------------------ */}
      {mode === 'write_mail' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setEmailSubmitted(false); setMode('need_help'); }}
              className={`p-2 rounded-xl transition-all cursor-pointer border ${
                theme === 'dark' 
                  ? 'hover:bg-white/10 text-gray-300 border-white/10 hover:text-white' 
                  : 'hover:bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className={`text-xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Compose Direct Civic Mail
              </h2>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                Send direct feedback or request special escalation regarding a local issue.
              </p>
            </div>
          </div>

          {emailSubmitted ? (
            <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3.5 animate-fadeIn">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 animate-scaleIn" />
              </div>
              <h3 className="text-base font-bold text-white">Support Request Dispatched</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                Thank you! Your concern has been pre-categorized and queued. A response will be dispatched to <strong className="text-white">{currentUser?.email || 'your registered address'}</strong> within 2 SLA business hours.
              </p>
              <p className="text-[10px] font-mono text-emerald-400/80 uppercase">
                TICKET DRAFT ID: CH-{Math.floor(100000 + Math.random() * 900000)}
              </p>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}`}>To</label>
                  <input
                    type="text"
                    value="grievance@kmcgov.in"
                    disabled
                    className={`w-full text-xs px-3 py-2 rounded-lg border cursor-not-allowed ${
                      theme === 'dark' 
                        ? 'border-white/10 bg-slate-950/60 text-gray-400' 
                        : 'border-slate-300 bg-slate-100 text-slate-700 font-bold'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}`}>Department Route</label>
                  <select
                    value={emailCategory}
                    onChange={(e) => setEmailCategory(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none ${
                      theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900 font-medium'
                    }`}
                  >
                    <option value="general" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>SLA General Escalation</option>
                    <option value="roads" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Roads & Sidewalk Repair</option>
                    <option value="power" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Street Lighting Division</option>
                    <option value="water" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Water Mains & Drainage</option>
                    <option value="feedback" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>Platform Technical Feedback</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}`}>Subject</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Delayed pothole resolution on Connaught Place corridor"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className={`w-full text-xs px-3.5 py-2 rounded-lg border outline-none ${
                    theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900 font-medium placeholder-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}`}>Detailed Message</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Kindly outline your concern in detail here. Please include issue details, nearby addresses, or SLA delays."
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className={`w-full text-xs px-3.5 py-2 rounded-lg border outline-none ${
                    theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900 font-medium placeholder-slate-400'
                  }`}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all cursor-pointer uppercase tracking-wider"
              >
                Send Support Request
              </button>
            </form>
          )}
        </motion.div>
      )}

      {/* ------------------ VIEW 5: MY TICKETS (Comprehensive history ledger) ------------------ */}
      {mode === 'my_tickets' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode('need_help')}
              className={`p-2 rounded-xl transition-all cursor-pointer border ${
                theme === 'dark' 
                  ? 'hover:bg-white/10 text-gray-300 border-white/10 hover:text-white' 
                  : 'hover:bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className={`text-xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                My Reported Tickets
              </h2>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                Historical view of all civic complaint files logged under your profile.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Real list */}
            {userTickets.length > 0 ? (
              userTickets.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-xl border space-y-3 transition-all ${
                    theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-indigo-400 font-mono font-bold">#{t.id.substring(0, 6).toUpperCase()}</span>
                      <span className={`text-xs font-black ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                        {getCategoryLabel(t.category)}
                      </span>
                    </div>
                    {getStatusBadge(t.status)}
                  </div>

                  <p className={`text-xs line-clamp-2 leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-medium'}`}>
                    {t.description}
                  </p>

                  <div className={`grid grid-cols-2 gap-2 text-[10px] pt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-800 font-extrabold'}`}>
                    <div className="truncate">📍 {t.location.address}</div>
                    <div className="text-right">⏱ SLA: {t.slaDays} Days</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 space-y-3">
                <Ticket className="w-10 h-10 text-slate-500 mx-auto" />
                <div>
                  <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No Real Tickets Logged</h4>
                  <p className={`text-xs mt-1 max-w-xs mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-slate-650 font-bold'}`}>
                    You have not registered any live tickets with the database yet. Click "Report Your Problem" to log an issue!
                  </p>
                </div>
                
                {/* Onboarding sample ticket as a backup view */}
                <div className="border-t border-dashed border-slate-300 dark:border-white/10 pt-4 mt-2 max-w-sm mx-auto">
                  <p className="text-[10px] text-indigo-500 dark:text-indigo-400 uppercase tracking-wider font-bold mb-2">Onboarding Demo Reference:</p>
                  <div className={`p-4 rounded-xl border text-left ${
                    theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/80 border-slate-300'
                  }`}>
                    <div className="flex justify-between items-center pb-2 border-b border-dashed border-indigo-500/10">
                      <span className="text-xs font-bold font-mono text-indigo-500 dark:text-indigo-400">#00524</span>
                      <span className="text-[9px] font-extrabold text-amber-600 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">Pending</span>
                    </div>
                    <div className="space-y-1 mt-2 text-[10px]">
                      <div><strong className={theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}>Route:</strong> <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-bold'}>Rabindra Kumar Sharma</span></div>
                      <div><strong className={theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}>Date:</strong> <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-bold'}>July 29, 2023 | 10:45</span></div>
                      <div><strong className={theme === 'dark' ? 'text-gray-400' : 'text-slate-700 font-extrabold'}>Type:</strong> <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-bold'}>General Civic Incident</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

    </div>
  );
}
