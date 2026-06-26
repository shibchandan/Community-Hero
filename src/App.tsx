/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import AuthPage from './components/AuthPage';
import { Issue, User, IssueStatus } from './types';
import InteractiveMap from './components/InteractiveMap';
import IssueReporter from './components/IssueReporter';
import CommunityFeed from './components/CommunityFeed';
import AuthorityControl from './components/AuthorityControl';
import GamificationLeaderboard from './components/GamificationLeaderboard';
import SlaDashboard from './components/SlaDashboard';
import { NotificationBell } from './components/NotificationDrawer';
import UserProfile from './components/UserProfile';
import Sidebar from './components/Sidebar';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { CivicBot } from './components/CivicBot';
import { 
  Map, FileText, Sparkles, Shield, Trophy, BarChart3,
  UserCheck, RefreshCw, Layers, Loader2, Menu, X
} from 'lucide-react';

// --- Session Persistence Helpers ---
const SESSION_KEY = 'civic_hero_session';
const THEME_KEY = 'civic_hero_theme';

function loadStoredSession(): import('./types').User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(user: import('./types').User | null) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage unavailable */ }
}

function loadStoredTheme(): 'dark' | 'light' {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === 'light' ? 'light' : 'dark';
  } catch { return 'dark'; }
}

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(loadStoredSession);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'map' | 'feed' | 'report' | 'authority' | 'leaderboard' | 'dashboard' | 'analytics' | 'profile'>('map');
  const [theme, setTheme] = useState<'dark' | 'light'>(loadStoredTheme);
  const [loading, setLoading] = useState(true);
  const [fbUser, setFbUser] = useState<any>(null);
  const [fbLoading, setFbLoading] = useState(!loadStoredSession()); // skip loading flash if we have a stored session
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyTab, setPolicyTab] = useState<'privacy' | 'terms'>('privacy');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalCityFilter, setGlobalCityFilter] = useState<string>('New Delhi');
  const [globalAreaFilter, setGlobalAreaFilter] = useState<string>('All Areas');
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem('civic_sidebar_expanded') !== 'false'; }
    catch { return true; }
  });

  // Persist session to localStorage whenever it changes
  useEffect(() => {
    saveSession(currentUser);
  }, [currentUser]);

  // Persist theme
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch { }
  }, [theme]);

  // Persist sidebar state
  useEffect(() => {
    try { localStorage.setItem('civic_sidebar_expanded', String(sidebarExpanded)); } catch { }
  }, [sidebarExpanded]);

  // Monitor Firebase Auth changes (if enabled) and sync with Express database
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setFbLoading(true);
        if (user) {
          setFbUser(user);
          try {
            const response = await fetch('/api/auth/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: user.uid,
                email: user.email,
                name: user.displayName || user.email?.split('@')[0],
                role: 'citizen'
              })
            });
            if (response.ok) {
              const data = await response.json();
              setCurrentUser(data.user);
              await syncState();
            }
          } catch (err) {
            console.error('Failed to sync auth user state with server:', err);
          }
        } else {
          setFbUser(null);
          setCurrentUser(null);
        }
        setFbLoading(false);
      });
      return () => unsubscribe();
    } else {
      // In local/custom auth mode — restore from localStorage immediately,
      // then validate & refresh from the server in the background
      const stored = loadStoredSession();
      if (stored) {
        setCurrentUser(stored);
        setFbLoading(false); // don't block UI — we already have cached data
        syncState();          // silently refresh in background
      } else {
        setFbLoading(true);
        syncState().finally(() => setFbLoading(false));
      }
    }
  }, []);

  // Sync state with the backend database
  const syncState = async () => {
    try {
      setLoading(true);
      // Fetch Issues
      const resIssues = await fetch('/api/issues');
      if (resIssues.ok) {
        const dataIssues = await resIssues.json();
        setIssues(dataIssues);
      }

      // Fetch Current Session User & persist to localStorage
      const resMe = await fetch('/api/users/me');
      if (resMe.ok) {
        const dataMe = await resMe.json();
        if (dataMe) {
          setCurrentUser(dataMe);
          saveSession(dataMe); // keep localStorage in sync with server
        }
      }

      // Fetch User list for Leaderboards
      const resUsers = await fetch('/api/users');
      if (resUsers.ok) {
        const dataUsers = await resUsers.json();
        setUsersList(dataUsers);
      }
    } catch (err) {
      console.error('Failed to synchronize database state with server:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setFbUser(null);
      setCurrentUser(null);
      saveSession(null); // clear persisted session on logout
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Subscribe to real-time updates from Firestore on mount
  useEffect(() => {
    setLoading(true);
    let pollingInterval: any = null;

    const startPollingFallback = () => {
      if (!pollingInterval) {
        console.log("Starting REST API polling fallback...");
        pollingInterval = setInterval(() => {
          syncState();
        }, 5000);
      }
    };

    const qIssues = collection(db, 'issues');
    const unsubscribeIssues = onSnapshot(qIssues, (snapshot) => {
      const fetchedIssues: Issue[] = [];
      snapshot.forEach((doc) => {
        fetchedIssues.push(doc.data() as Issue);
      });
      // Sort issues by createdAt (descending)
      const sortedIssues = fetchedIssues.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setIssues(sortedIssues);
      setLoading(false);
    }, (error) => {
      console.error("Firestore real-time issues subscription error, falling back to polling:", error);
      syncState();
      startPollingFallback();
    });

    const qUsers = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const fetchedUsers: User[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push(doc.data() as User);
      });
      // Sort users by points (descending) for leaderboard
      const sortedUsers = fetchedUsers.sort((a, b) => b.points - a.points);
      setUsersList(sortedUsers);
    }, (error) => {
      console.error("Firestore real-time users subscription error, falling back to polling:", error);
      syncState();
      startPollingFallback();
    });

    // Also fetch current session info
    const fetchSession = async () => {
      try {
        const resMe = await fetch('/api/users/me');
        if (resMe.ok) {
          const dataMe = await resMe.json();
          setCurrentUser(dataMe);
        }
      } catch (err) {
        console.error("Failed to sync initial session user:", err);
      }
    };
    fetchSession();

    return () => {
      unsubscribeIssues();
      unsubscribeUsers();
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  // Handle shared link routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedIssueId = params.get('issueId');
    if (sharedIssueId) {
      setActiveTab('feed');
      setSelectedIssueId(sharedIssueId);
    }
  }, []);

  // Hot-swap session roles
  const handleToggleRole = async () => {
    try {
      const response = await fetch('/api/users/toggle-role', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        syncState();
      }
    } catch (err) {
      console.error('Failed to toggle session user role:', err);
    }
  };

  // Vote valid / invalid
  const handleVote = async (issueId: string, voteType: 'valid' | 'invalid') => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    try {
      const response = await fetch(`/api/issues/${issueId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType })
      });
      if (response.ok) {
        syncState();
      }
    } catch (err) {
      console.error('Failed to submit vote supporting issue:', err);
    }
  };

  // ── Global Filter Memoization ───────────────────────────────────────────────
  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    issues.forEach(issue => {
      if (issue.location?.city) cities.add(issue.location.city);
    });
    return Array.from(cities).sort();
  }, [issues]);

  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    issues.forEach(issue => {
      if (globalCityFilter === 'All Cities' || issue.location?.city === globalCityFilter) {
        if (issue.location?.area) areas.add(issue.location.area);
      }
    });
    return Array.from(areas).sort();
  }, [issues, globalCityFilter]);

  const displayedIssues = useMemo(() => {
    return issues.filter(issue => {
      const cityMatches = globalCityFilter === 'All Cities' || issue.location?.city === globalCityFilter;
      if (!cityMatches) return false;
      
      if (globalAreaFilter === 'All Areas') return true;
      return issue.location?.area === globalAreaFilter;
    });
  }, [issues, globalAreaFilter, globalCityFilter]);

  // Add Comment
  const handleAddComment = async (issueId: string, text: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    try {
      const response = await fetch(`/api/issues/${issueId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (response.ok) {
        syncState();
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
    }
  };

  // Update Status (Authority workflow dispatch)
  const handleUpdateStatus = async (issueId: string, status: IssueStatus, notes: string, proofImage?: string) => {
    try {
      const response = await fetch(`/api/issues/${issueId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, proofImage })
      });
      if (response.ok) {
        syncState();
      }
    } catch (err) {
      console.error('Failed to commit authority status update:', err);
    }
  };

  // SLA time fast-forward simulation
  const handleFastForwardTime = async (days: number) => {
    try {
      const response = await fetch('/api/system/fast-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days })
      });
      if (response.ok) {
        syncState();
      }
    } catch (err) {
      console.error('Failed to fast-forward SLA clock:', err);
    }
  };

  // Map click or list click selecting an issue
  const handleSelectIssue = (issue: Issue) => {
    setSelectedIssueId(issue.id);
    setActiveTab('feed');
  };

  const activeIssue = displayedIssues.find(i => i.id === selectedIssueId);

  if (fbLoading) {
    return (
      <div className="min-h-screen bento-bg flex flex-col justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-xs text-gray-400 mt-4 font-bold tracking-wider uppercase">Verifying Civic Credentials...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans antialiased transition-all duration-500 overflow-x-hidden relative theme-${theme} ${
      theme === 'dark' 
        ? 'bento-bg text-slate-100' 
        : 'bento-bg-light text-slate-800'
    }`}>

      {/* Decorative Blur Circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-[120px] animate-glow-slow-1" />
        <div className="absolute top-[30%] -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-[150px] animate-glow-slow-2" />
        <div className="absolute -bottom-40 left-[20%] w-[550px] h-[550px] rounded-full bg-emerald-500/10 blur-[130px] animate-glow-slow-1" />
      </div>

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────── */}
      <div className="hidden lg:block">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          theme={theme}
          setTheme={setTheme}
          currentUser={currentUser}
          issues={displayedIssues}
          loading={loading}
          expanded={sidebarExpanded}
          setExpanded={setSidebarExpanded}
          onLogin={() => setShowAuthModal(true)}
          onLogout={handleLogout}
          onToggleRole={handleToggleRole}
          onSelectIssue={(issueId) => {
            const found = displayedIssues.find(i => i.id === issueId);
            if (found) { handleSelectIssue(found); }
          }}
        />
      </div>

      {/* ── MOBILE HEADER BAR ────────────────────────────────────── */}
      <div className={`lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 border-b backdrop-blur-xl ${
        theme === 'dark'
          ? 'bg-slate-950/90 border-white/10'
          : 'bg-white/90 border-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className={`text-sm font-black font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Community Hero</p>
            <p className={`text-[9px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-cyan-400' : 'text-indigo-500'}`}>Civic Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell issues={displayedIssues} currentUser={currentUser} theme={theme}
            onSelectIssue={(id) => { const f = displayedIssues.find(i => i.id === id); if (f) handleSelectIssue(f); }}
          />
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`p-2 rounded-xl border cursor-pointer ${
              theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── MOBILE DRAWER ───────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              key="mob-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              key="mob-drawer"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col lg:hidden ${
                theme === 'dark' ? 'bg-slate-950 border-r border-white/10' : 'bg-white border-r border-slate-200'
              }`}
            >
              <Sidebar
                activeTab={activeTab}
                setActiveTab={(t) => { setActiveTab(t); setMobileMenuOpen(false); }}
                theme={theme}
                setTheme={setTheme}
                currentUser={currentUser}
                issues={displayedIssues}
                loading={loading}
                expanded={true}
                setExpanded={() => {}}
                onLogin={() => { setShowAuthModal(true); setMobileMenuOpen(false); }}
                onLogout={() => { handleLogout(); setMobileMenuOpen(false); }}
                onToggleRole={() => { handleToggleRole(); setMobileMenuOpen(false); }}
                onSelectIssue={(id) => { const f = displayedIssues.find(i => i.id === id); if (f) { handleSelectIssue(f); setMobileMenuOpen(false); } }}
              />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className={`absolute top-4 right-4 p-1.5 rounded-lg cursor-pointer ${
                  theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Sandbox Banner (status bar) ──────────────────────────── */}
      <motion.div
        animate={{ marginLeft: typeof window !== 'undefined' && window.innerWidth >= 1024 ? (sidebarExpanded ? 220 : 64) : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className={`relative z-20 mx-4 mt-20 lg:mt-4 rounded-2xl backdrop-blur-md shadow-lg border transition-all ${
          theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/70 border-white/40 shadow-slate-200/50'
        }`}
      >
        {currentUser ? (
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 px-4">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div className="text-xs flex flex-wrap items-center gap-1.5">
                <span className={`font-bold uppercase tracking-wider text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Sandbox</span>
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{currentUser.name}</span>
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                  currentUser.role === 'authority'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                }`}>{currentUser.role}</span>
                {currentUser.role === 'citizen' && (
                  <span className={`font-mono text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                    {currentUser.points} pts · {currentUser.trust_score}% trust
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={globalCityFilter}
                onChange={(e) => setGlobalCityFilter(e.target.value)}
                className={`text-[9px] px-2 py-1.5 rounded-xl border font-black uppercase tracking-wider focus:outline-none cursor-pointer ${
                  theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
                title="Filter by City"
              >
                <option value="All Cities">🌎 ALL CITIES</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>📍 {city.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={globalAreaFilter}
                onChange={(e) => setGlobalAreaFilter(e.target.value)}
                className={`text-[9px] px-2 py-1.5 rounded-xl border font-black uppercase tracking-wider focus:outline-none cursor-pointer ${
                  theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
                title="Filter by Zone"
              >
                <option value="All Areas">🌎 ALL ZONES</option>
                {availableAreas.map(area => (
                  <option key={area} value={area}>📍 {area.toUpperCase()}</option>
                ))}
              </select>
              <button onClick={handleToggleRole}
                className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
                <Layers className="w-3.5 h-3.5" /> Toggle Identity
              </button>
              <button onClick={syncState}
                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                  theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`} title="Sync">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 px-4">
            <div className="flex items-center gap-3 text-xs">
              <span className="flex h-3 w-3 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
              </span>
              <span className={`font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Browsing as Guest — sign in to report, vote &amp; earn points</span>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={globalCityFilter}
                onChange={(e) => setGlobalCityFilter(e.target.value)}
                className={`text-[9px] px-2 py-1.5 rounded-xl border font-black uppercase tracking-wider focus:outline-none cursor-pointer ${
                  theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
                title="Filter by City"
              >
                <option value="All Cities">🌎 ALL CITIES</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>📍 {city.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={globalAreaFilter}
                onChange={(e) => setGlobalAreaFilter(e.target.value)}
                className={`text-[9px] px-2 py-1.5 rounded-xl border font-black uppercase tracking-wider focus:outline-none cursor-pointer ${
                  theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
                title="Filter by Zone"
              >
                <option value="All Areas">🌎 ALL ZONES</option>
                {availableAreas.map(area => (
                  <option key={area} value={area}>📍 {area.toUpperCase()}</option>
                ))}
              </select>
              <button onClick={() => setShowAuthModal(true)}
                className="text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
                Sign In / Register
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ------------------ MAIN INTERACTIVE CONTAINER ------------------ */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider animate-pulse">Syncing civic databases...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {/* 1. Radar Map Tab */}
              {activeTab === 'map' && (
                <motion.div
                  key="map"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 xl:grid-cols-4 gap-6"
                >
                  <div className="xl:col-span-3">
                    <InteractiveMap 
                      issues={displayedIssues} 
                      onSelectIssue={handleSelectIssue}
                      selectedIssueId={selectedIssueId}
                      theme={theme}
                    />
                  </div>
                  {/* Micro sidebar with short overview */}
                  <div className="xl:col-span-1 space-y-4">
                    <div className="p-5 bento-card">
                      <h4 className="text-sm font-bold font-display text-white mb-2 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        Active Sector Overview
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Select any pin on the radar map to view its active validation states, upvotes, and departmental assignment timelines.
                      </p>
                      <div className="mt-4 border-t border-white/10 pt-3 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Potholes & Roads:</span>
                          <span className="font-bold font-mono text-white">{displayedIssues.filter(i => i.category === 'road').length} cases</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Garbage Overflows:</span>
                          <span className="font-bold font-mono text-white">{displayedIssues.filter(i => i.category === 'garbage').length} cases</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Broken Streetlights:</span>
                          <span className="font-bold font-mono text-white">{displayedIssues.filter(i => i.category === 'streetlight').length} cases</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('report')}
                      aria-label="Navigate to report a new hazard"
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4.5 h-4.5" /> Log New Incident Map
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 2. Civic Board Tab */}
              {activeTab === 'feed' && (
                <motion.div
                  key="feed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 lg:grid-cols-4 gap-6"
                >
                  <div className="lg:col-span-3">
                    <CommunityFeed 
                      issues={displayedIssues}
                      selectedIssueId={selectedIssueId}
                      onSelectIssue={handleSelectIssue}
                      onVote={handleVote}
                      onAddComment={handleAddComment}
                      currentUserRole={currentUser?.role || 'citizen'}
                      theme={theme}
                    />
                  </div>
                  {/* Filter / Selected info card */}
                  <div className={`lg:col-span-1 ${activeIssue ? 'block' : 'hidden lg:block'}`}>
                    {activeIssue ? (
                      <div className="p-5 bento-card sticky top-6 space-y-4">
                        <h4 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Quick Details Focused</h4>
                        <img src={activeIssue.mediaUrl} alt={activeIssue.title} referrerPolicy="no-referrer" className={`w-full aspect-video rounded-xl object-cover border ${theme === 'dark' ? 'border-white/10' : 'border-slate-300'}`} />
                        <div>
                          <h3 className={`text-sm font-bold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900 font-extrabold'}`}>{activeIssue.title}</h3>
                          <p className={`text-[11px] mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-semibold'}`}>Landmark: {activeIssue.location.address}</p>
                        </div>
                        <div className={`border-t pt-3 space-y-1.5 text-xs ${
                          theme === 'dark' ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-750 font-medium'
                        }`}>
                          <div className="flex justify-between">
                            <span>SLA Goal:</span>
                            <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900 font-extrabold'}`}>{activeIssue.slaDays} Days</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Authority Route:</span>
                            <span className={`font-bold truncate max-w-[120px] ${theme === 'dark' ? 'text-white' : 'text-slate-900 font-extrabold'}`}>{activeIssue.department}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 bento-card sticky top-6 text-center">
                        <Layers className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <h4 className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800 font-extrabold'}`}>Focused View Empty</h4>
                        <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>Select an issue from the feed stream to inspect full comments, validation support, and details.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 3. Report Hazard Tab */}
              {activeTab === 'report' && (
                <motion.div
                  key="report"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  {currentUser ? (
                    <div className="max-w-3xl mx-auto">
                      <IssueReporter 
                        onIssueReported={(newIssue) => {
                          handleSelectIssue(newIssue);
                        }}
                        activeArea={currentUser?.area || 'Mission District'}
                        issues={displayedIssues}
                        currentUser={currentUser}
                        theme={theme}
                      />
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto p-8 rounded-2xl bento-card text-center border border-white/10 relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 to-blue-600" />
                      <Sparkles className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-white font-display">Report Civic Hazard</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        You must sign in or register to report a new civic issue. Our AI automatically classifies and routes reported issues to city maintenance teams.
                      </p>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        aria-label="Sign in to report a civic hazard"
                        className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-lg shadow-indigo-500/20"
                      >
                        Sign In to Continue
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 4. SLA Dispatch Tab */}
              {activeTab === 'authority' && (
                <motion.div
                  key="authority"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  {currentUser ? (
                    <div className="max-w-4xl mx-auto">
                      <AuthorityControl 
                        issues={displayedIssues}
                        onUpdateStatus={handleUpdateStatus}
                        onFastForwardTime={handleFastForwardTime}
                        theme={theme}
                      />
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto p-8 rounded-2xl bento-card text-center border border-white/10 relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-rose-500 to-orange-500" />
                      <Shield className="w-12 h-12 text-rose-400 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-white font-display">SLA Dispatch Console</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        Access to the SLA Dispatch work orders console is restricted to authorized municipal accounts. Please sign in to access dispatcher tools.
                      </p>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        aria-label="Sign in to access SLA Dispatch tools"
                        className="mt-6 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-lg shadow-rose-500/20"
                      >
                        Sign In to Continue
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 5. Leaderboard Tab */}
              {activeTab === 'leaderboard' && (
                <motion.div
                  key="leaderboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  {currentUser ? (
                    <GamificationLeaderboard 
                      currentUser={currentUser}
                      usersList={usersList}
                      theme={theme}
                    />
                  ) : (
                    <div className="max-w-md mx-auto p-8 rounded-2xl bento-card text-center border border-white/10 relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-yellow-500" />
                      <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-white font-display">Hero Center</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        Track community impact scores, unlock badges, and rise in ranks! Sign in to view your profile and the citizen leaderboard.
                      </p>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        aria-label="Sign in to view Hero leaderboard"
                        className="mt-6 px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-lg shadow-amber-500/20"
                      >
                        Sign In to Continue
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 6. Dashboard SLA Tab */}
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  <SlaDashboard 
                    issues={displayedIssues} 
                    usersList={usersList} 
                    theme={theme} 
                  />
                </motion.div>
              )}

              {/* 6.b Analytics Dashboard Tab (Admins) */}
              {activeTab === 'analytics' && (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  <AnalyticsDashboard 
                    issues={displayedIssues} 
                    theme={theme} 
                  />
                </motion.div>
              )}

              {/* 7. My Profile Tab */}
              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  {currentUser ? (
                    <UserProfile
                      currentUser={currentUser}
                      issues={issues}
                      theme={theme}
                      onViewIssue={(issue) => {
                        handleSelectIssue(issue);
                        setActiveTab('feed');
                      }}
                    />
                  ) : (
                    <div className="max-w-md mx-auto p-8 rounded-2xl bento-card text-center border border-white/10 relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-500 to-indigo-600" />
                      <UserCheck className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-white font-display">My Civic Profile</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        Sign in to view your profile, submitted reports, badges, and trust score.
                      </p>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-lg shadow-indigo-500/20"
                      >
                        Sign In to Continue
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
 
      </main>
 
      {/* Footer */}
      <footer className={`relative z-10 max-w-3xl mx-auto px-6 py-5 mt-8 mb-6 text-center text-xs rounded-2xl border backdrop-blur-md transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-slate-950/40 border-white/10 text-slate-300 shadow-black/20'
          : 'bg-white/80 border-indigo-200/50 text-slate-800 shadow-indigo-100/30 shadow-md font-medium'
      }`}>
        <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          © 2026 Community Hero Civic Platform.
        </p>
        <p className={`mt-1 text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
          Ensuring accountability and transparency in municipal services.
        </p>
        <div className="mt-3.5 flex items-center justify-center gap-4 text-[11px] font-bold">
          <button 
            onClick={() => { setPolicyTab('privacy'); setShowPolicyModal(true); }}
            className={`transition-colors hover:underline cursor-pointer ${
              theme === 'dark' 
                ? 'text-indigo-400 hover:text-indigo-300' 
                : 'text-indigo-700 hover:text-indigo-800 font-extrabold'
            }`}
          >
            Privacy Policy
          </button>
          <span className={`opacity-40 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>•</span>
          <button 
            onClick={() => { setPolicyTab('terms'); setShowPolicyModal(true); }}
            className={`transition-colors hover:underline cursor-pointer ${
              theme === 'dark' 
                ? 'text-indigo-400 hover:text-indigo-300' 
                : 'text-indigo-700 hover:text-indigo-800 font-extrabold'
            }`}
          >
            Terms of Service
          </button>
        </div>
      </footer>

      {/* ------------------ FLOATING PRIVACY POLICY & TOS MODAL OVERLAY ------------------ */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden animate-scaleIn">
            
            {/* Header Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 px-6 pt-5 pb-0">
              <div className="flex gap-4">
                <button
                  onClick={() => setPolicyTab('privacy')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    policyTab === 'privacy' 
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                      : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Privacy Policy
                </button>
                <button
                  onClick={() => setPolicyTab('terms')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    policyTab === 'terms' 
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                      : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Terms of Service
                </button>
              </div>
              <button 
                onClick={() => setShowPolicyModal(false)}
                className="ml-auto text-gray-400 hover:text-gray-900 dark:hover:text-white pb-3 transition-all cursor-pointer font-black text-sm"
              >
                ✕ Close
              </button>
            </div>

            {/* Scrollable Policy Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {policyTab === 'privacy' ? (
                <>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Community Hero Privacy & Geolocation Policy
                  </h3>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-mono">
                    Last Updated: June 2026
                  </p>
                  
                  <div className="space-y-3">
                    <p>
                      <strong>1. Overview:</strong> Community Hero is committed to protecting your privacy while enabling hyper-local civic problem-solving. This document describes how we capture, encrypt, and store spatial landmarks and community reporting imagery.
                    </p>
                    <p>
                      <strong>2. Geolocation & Spatial Data:</strong> To verify issue veracity and cluster nearby problems, the application dynamically reads device-level GPS coordinates. This spatial telemetry is converted into coordinates on your regional map and stored in secure database collections. We do not track your location in the background.
                    </p>
                    <p>
                      <strong>3. Photographic Submissions:</strong> Hazard photos uploaded via the <em>Issue Reporter</em> are evaluated by the local Computer Vision API to categorize safety threats. Any personnel faces, license plates, or identifying personal information detected in photos are automatically obfuscated on high-resolution maps.
                    </p>
                    <p>
                      <strong>4. Data Security & Storage:</strong> Account profiles and contribution scoring logs are persisted securely within Cloud Firestore database infrastructure. Passwords and credentials are managed using Firebase Authentication's industry-grade cryptographic keys.
                    </p>
                    <p>
                      <strong>5. Your Rights & Whistleblower Protections:</strong> You may request complete deletion of your account record and reported issues at any time. Active citizens who wish to file reports of public corruption or sensitive municipal neglect are safeguarded under our platform's whistleblower protection schemas.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Community Hero Terms of Service & Civic SLA Code
                  </h3>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-mono">
                    Last Updated: June 2026
                  </p>

                  <div className="space-y-3">
                    <p>
                      <strong>1. Agreement to Terms:</strong> By accessing the Community Hero platform, you agree to comply with this municipal collaboration agreement. If you do not agree, you are restricted from utilizing our automated routing, voting, or dashboard services.
                    </p>
                    <p>
                      <strong>2. Citizen Conduct & Integrity:</strong> Users are strictly prohibited from reporting fraudulent civic claims, uploading unrelated graphic media, or inputting fake GPS coordinates. AI duplicate checks and local validator algorithms will immediately flag violations.
                    </p>
                    <p>
                      <strong>3. Gamification & Points Rules:</strong> Karma points, solver rank badges (Guardian, Ambassador, Vigilante), and daily patrol multipliers must be earned via authentic actions (valid reports, accurate verification, and true resolutions). Attempting to exploit automated voting or spoof coordinates will result in an immediate Trust Score deduction or permanent block.
                    </p>
                    <p>
                      <strong>4. Municipal Responsibility Limitation:</strong> Community Hero acts as an AI-powered routing gateway. While we programmatically escalate verified issues to department agents and display active SLA timelines, actual physical resolution timelines remain subject to city resources and local safety guidelines.
                    </p>
                    <p>
                      <strong>5. Terminations & Appeals:</strong> Community administrators reserve the right to temporarily freeze community validation privileges for any user found intentionally disrupting local routing flows. Citizens may lodge appeals with our direct escalation routing desk via email.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-950 px-6 py-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-mono">
                Platform Ver. 2.1.0 • Open Civic License
              </span>
              <button
                onClick={() => setShowPolicyModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
              >
                I Understand
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------ FLOATING AUTH MODAL OVERLAY ------------------ */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 rounded-2xl border border-white/10 shadow-2xl p-1 overflow-hidden animate-scaleIn">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-xl transition-all z-50 cursor-pointer"
              title="Close Panel"
              aria-label="Close authentication panel"
            >
              ✕
            </button>
            <AuthPage 
              onAuthSuccess={() => {
                setShowAuthModal(false);
                syncState();
              }} 
              inline={true} 
            />
          </div>
        </div>
      )}

      {/* ── Global AI Chatbot ────────────────────────────────────────── */}
      <CivicBot theme={theme} />
 
    </div>
  );
}
