/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import AuthPage from './components/AuthPage';
import { Issue, User, IssueStatus } from './types';
import InteractiveMap from './components/InteractiveMap';
import IssueReporter from './components/IssueReporter';
import CommunityFeed from './components/CommunityFeed';
import AuthorityControl from './components/AuthorityControl';
import GamificationLeaderboard from './components/GamificationLeaderboard';
import SlaDashboard from './components/SlaDashboard';
import { 
  Map, FileText, Sparkles, Shield, Trophy, BarChart3, 
  Sun, Moon, Users, UserCheck, RefreshCw, Layers, LogOut, Loader2, LogIn 
} from 'lucide-react';

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'map' | 'feed' | 'report' | 'authority' | 'leaderboard' | 'dashboard'>('map');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [loading, setLoading] = useState(true);
  const [fbUser, setFbUser] = useState<any>(null);
  const [fbLoading, setFbLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Monitor Firebase Auth changes and sync with Express database
  useEffect(() => {
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

      // Fetch Current Session User
      const resMe = await fetch('/api/users/me');
      if (resMe.ok) {
        const dataMe = await resMe.json();
        setCurrentUser(dataMe);
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
      await signOut(auth);
      await fetch('/api/auth/logout', { method: 'POST' });
      setFbUser(null);
      setCurrentUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Subscribe to real-time updates from Firestore on mount
  useEffect(() => {
    setLoading(true);
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
      console.error("Firestore real-time issues subscription error:", error);
      setLoading(false);
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
      console.error("Firestore real-time users subscription error:", error);
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
    };
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

  const activeIssue = issues.find(i => i.id === selectedIssueId);

  if (fbLoading) {
    return (
      <div className="min-h-screen bento-bg flex flex-col justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-xs text-gray-400 mt-4 font-bold tracking-wider uppercase">Verifying Civic Credentials...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans antialiased transition-all duration-500 overflow-x-hidden relative ${
      theme === 'dark' 
        ? 'bento-bg text-slate-100' 
        : 'bg-slate-50 text-slate-800'
    }`}>
      
      {/* Decorative Blur Circles (Glassmorphism ambient glow backlights) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-[120px] animate-glow-slow-1" />
        <div className="absolute top-[30%] -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-[150px] animate-glow-slow-2" />
        <div className="absolute -bottom-40 left-[20%] w-[550px] h-[550px] rounded-full bg-emerald-500/10 blur-[130px] animate-glow-slow-1" />
      </div>

      {/* ------------------ FLOATING COGNITIVE SIMULATION CONTROLLER ------------------ */}
      <div className="relative z-50 max-w-7xl mx-auto px-4 pt-4">
        {currentUser ? (
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <div className="text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Active Hackathon Persona Sandbox</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-white">
                    {currentUser.name} 
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                    currentUser.role === 'authority' 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {currentUser.role}
                  </span>
                  {currentUser.role === 'citizen' && (
                    <span className="text-gray-400 ml-1.5 font-mono text-[10px]">
                      Points: {currentUser.points} pts • Trust: {currentUser.trust_score}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={handleToggleRole}
                aria-label="Toggle Persona Identity Experience"
                className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" /> Toggle Identity Experience
              </button>

              <button
                onClick={syncState}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all cursor-pointer"
                title="Sync Database State"
                aria-label="Synchronize database state from Firestore"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Theme Selector */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all cursor-pointer"
                aria-label={theme === 'dark' ? "Switch to light theme" : "Switch to dark theme"}
                title={theme === 'dark' ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Log Out */}
              <button
                onClick={handleLogout}
                className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-rose-400 transition-all flex items-center gap-1 cursor-pointer"
                title="Sign Out"
                aria-label="Sign out of your account"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500"></span>
              </span>
              <div className="text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Browsing Mode</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-bold text-white">Guest Citizen</span>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-400 border border-slate-500/20">
                    Guest
                  </span>
                  <span className="text-gray-400 ml-1.5 font-mono text-[10px]">
                    Authenticate to vote, comment, or report hazards
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              {/* Theme Selector */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all cursor-pointer"
                aria-label={theme === 'dark' ? "Switch to light theme" : "Switch to dark theme"}
                title={theme === 'dark' ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setShowAuthModal(true)}
                className="text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                aria-label="Open sign in or register authentication modal"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In / Register
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------ NAVIGATION HEADER ------------------ */}
      <header className="relative z-10 max-w-7xl mx-auto px-4 pt-6">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 py-5 px-6 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-display">
                Community Hero
              </h1>
              <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest">
                Civic Intelligence Engine
              </p>
            </div>
          </div>

          {/* Navigation tabs with full WAI-ARIA tablist semantics */}
          <nav role="tablist" aria-label="Civic Navigation Tabs" className="flex flex-wrap gap-2 w-full xl:w-auto">
            <button
              role="tab"
              aria-selected={activeTab === 'map'}
              aria-label="Explore Radar Map Tab"
              onClick={() => setActiveTab('map')}
              className={`flex-1 xl:flex-initial text-xs font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Map className="w-4 h-4" /> Explore Radar
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'feed'}
              aria-label="Civic Incident Feed Tab"
              onClick={() => setActiveTab('feed')}
              className={`flex-1 xl:flex-initial text-xs font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'feed'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText className="w-4 h-4" /> Civic Feed
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'report'}
              aria-label="Report New Hazard Tab"
              onClick={() => setActiveTab('report')}
              className={`flex-1 xl:flex-initial text-xs font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Report Hazard
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'authority'}
              aria-label="SLA Dispatch Console Tab"
              onClick={() => setActiveTab('authority')}
              className={`flex-1 xl:flex-initial text-xs font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'authority'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Shield className="w-4 h-4" /> SLA Dispatch
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'leaderboard'}
              aria-label="Hero Leaderboard Center Tab"
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 xl:flex-initial text-xs font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Trophy className="w-4 h-4" /> Hero Center
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'dashboard'}
              aria-label="SLA Analytics Dashboard Tab"
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 xl:flex-initial text-xs font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> SLA Analytics
            </button>
          </nav>
        </div>
      </header>

      {/* ------------------ MAIN INTERACTIVE CONTAINER ------------------ */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider animate-pulse">Syncing civic databases...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* 1. Radar Map Tab */}
            {activeTab === 'map' && (
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3">
                  <InteractiveMap 
                    issues={issues} 
                    onSelectIssue={handleSelectIssue}
                    selectedIssueId={selectedIssueId}
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
                        <span className="font-bold font-mono text-white">{issues.filter(i => i.category === 'road').length} cases</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Garbage Overflows:</span>
                        <span className="font-bold font-mono text-white">{issues.filter(i => i.category === 'garbage').length} cases</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Broken Streetlights:</span>
                        <span className="font-bold font-mono text-white">{issues.filter(i => i.category === 'streetlight').length} cases</span>
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
              </div>
            )}

            {/* 2. Civic Board Tab */}
            {activeTab === 'feed' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                  <CommunityFeed 
                    issues={issues}
                    selectedIssueId={selectedIssueId}
                    onSelectIssue={handleSelectIssue}
                    onVote={handleVote}
                    onAddComment={handleAddComment}
                    currentUserRole={currentUser?.role || 'citizen'}
                  />
                </div>
                {/* Filter / Selected info card */}
                <div className="lg:col-span-1">
                  {activeIssue ? (
                    <div className="p-5 bento-card sticky top-6 space-y-4">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Quick Details Focused</h4>
                      <img src={activeIssue.mediaUrl} alt={activeIssue.title} className="w-full aspect-video rounded-xl object-cover border border-white/10" />
                      <div>
                        <h3 className="text-sm font-bold text-white leading-tight">{activeIssue.title}</h3>
                        <p className="text-[11px] text-slate-400 mt-1">Landmark: {activeIssue.location.address}</p>
                      </div>
                      <div className="border-t border-white/10 pt-3 space-y-1.5 text-xs text-slate-400">
                        <div className="flex justify-between">
                          <span>SLA Goal:</span>
                          <span className="font-bold text-white">{activeIssue.slaDays} Days</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Authority Route:</span>
                          <span className="font-bold text-white truncate max-w-[120px]">{activeIssue.department}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 bento-card sticky top-6 text-center">
                      <Layers className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <h4 className="text-xs font-bold text-slate-300">Focused View Empty</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Select an issue from the feed stream to inspect full comments, validation support, and details.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Report Hazard Tab */}
            {activeTab === 'report' && (
              currentUser ? (
                <div className="max-w-3xl mx-auto">
                  <IssueReporter 
                    onIssueReported={(newIssue) => {
                      handleSelectIssue(newIssue);
                    }}
                    activeArea={currentUser?.area || 'Mission District'}
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
              )
            )}
 
            {/* 4. SLA Dispatch Tab */}
            {activeTab === 'authority' && (
              currentUser ? (
                <div className="max-w-4xl mx-auto">
                  <AuthorityControl 
                    issues={issues}
                    onUpdateStatus={handleUpdateStatus}
                    onFastForwardTime={handleFastForwardTime}
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
              )
            )}
 
            {/* 5. Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              currentUser ? (
                <GamificationLeaderboard 
                  currentUser={currentUser}
                  usersList={usersList}
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
              )
            )}
 
            {/* 6. Dashboard SLA Tab */}
            {activeTab === 'dashboard' && (
              <SlaDashboard issues={issues} />
            )}
 
          </div>
        )}
 
      </main>
 
      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto px-4 py-8 mt-12 text-center text-xs text-slate-400 border-t border-slate-200/30 dark:border-slate-800/30">
        <p>© 2026 Community Hero Civic Platform.</p>
        <p className="mt-1 opacity-60">Ensuring accountability and transparency in municipal services.</p>
      </footer>

      {/* ------------------ FLOATING AUTH MODAL OVERLAY ------------------ */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-slate-900 rounded-2xl border border-white/10 shadow-2xl p-1 overflow-hidden">
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
 
    </div>
  );
}
