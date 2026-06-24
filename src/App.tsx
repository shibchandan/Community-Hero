/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
import { 
  Map, FileText, Sparkles, Shield, Trophy, BarChart3, 
  Sun, Moon, Users, UserCheck, RefreshCw, Layers, LogOut, Loader2, LogIn,
  Menu, X
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
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyTab, setPolicyTab] = useState<'privacy' | 'terms'>('privacy');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className={`min-h-screen font-sans antialiased transition-all duration-500 overflow-x-hidden relative theme-${theme} ${
      theme === 'dark' 
        ? 'bento-bg text-slate-100' 
        : 'bento-bg-light text-slate-800'
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
          <div className={`flex flex-col md:flex-row gap-3 items-center justify-between p-4 rounded-2xl backdrop-blur-md shadow-lg border transition-all ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10 shadow-black/40' 
              : 'bg-white/70 border-white/40 shadow-slate-200/50'
          }`}>
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <div className="text-xs">
                <span className={`font-bold uppercase tracking-wider text-[10px] ${
                  theme === 'dark' ? 'text-gray-400' : 'text-slate-500'
                }`}>Active Hackathon Persona Sandbox</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
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
                    <span className={`font-mono text-[10px] ml-1.5 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-slate-500'
                    }`}>
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
                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}
                title="Sync Database State"
                aria-label="Synchronize database state from Firestore"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Theme Selector */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}
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
          <div className={`flex flex-col md:flex-row gap-3 items-center justify-between p-4 rounded-2xl backdrop-blur-md shadow-lg border transition-all ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10 shadow-black/40' 
              : 'bg-white/70 border-white/40 shadow-slate-200/50'
          }`}>
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500"></span>
              </span>
              <div className="text-xs">
                <span className={`font-bold uppercase tracking-wider text-[10px] ${
                  theme === 'dark' ? 'text-gray-400' : 'text-slate-500'
                }`}>Browsing Mode</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Guest Citizen</span>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-400 border border-slate-500/20">
                    Guest
                  </span>
                  <span className={`font-mono text-[10px] ml-1.5 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Authenticate to vote, comment, or report hazards
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              {/* Theme Selector */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}
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

      {/* ------------------ MOBILE DRAWER MENU ------------------ */}
      <div 
        className={`fixed inset-0 z-50 transition-all duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop overlay */}
        <div 
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs" 
          onClick={() => setMobileMenuOpen(false)}
        />
        
        {/* Drawer container */}
        <div 
          className={`absolute inset-y-0 left-0 w-72 p-6 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out transform ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } ${
            theme === 'dark' 
              ? 'bg-slate-950/95 border-r border-white/10 text-white' 
              : 'bg-white border-r border-slate-200 text-slate-900'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-md font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Community Hero</h2>
                  <p className="text-[9px] text-blue-500 font-semibold tracking-widest uppercase">Civic Engine</p>
                </div>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  theme === 'dark' ? 'hover:bg-white/10 text-gray-300 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                }`}
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1.5 mt-6" role="tablist" aria-label="Mobile Civic Navigation Tabs">
              <button
                role="tab"
                aria-selected={activeTab === 'map'}
                onClick={() => { setActiveTab('map'); setMobileMenuOpen(false); }}
                className={`w-full text-xs font-bold py-3 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                  activeTab === 'map'
                    ? 'bg-indigo-600 text-white shadow-lg border border-indigo-500/50'
                    : theme === 'dark'
                      ? 'bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Map className="w-4 h-4" /> Explore Radar
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'feed'}
                onClick={() => { setActiveTab('feed'); setMobileMenuOpen(false); }}
                className={`w-full text-xs font-bold py-3 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                  activeTab === 'feed'
                    ? 'bg-indigo-600 text-white shadow-lg border border-indigo-500/50'
                    : theme === 'dark'
                      ? 'bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" /> Civic Feed
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'report'}
                onClick={() => { setActiveTab('report'); setMobileMenuOpen(false); }}
                className={`w-full text-xs font-bold py-3 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                  activeTab === 'report'
                    ? 'bg-indigo-600 text-white shadow-lg border border-indigo-500/50'
                    : theme === 'dark'
                      ? 'bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4" /> Report Hazard
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'authority'}
                onClick={() => { setActiveTab('authority'); setMobileMenuOpen(false); }}
                className={`w-full text-xs font-bold py-3 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                  activeTab === 'authority'
                    ? 'bg-indigo-600 text-white shadow-lg border border-indigo-500/50'
                    : theme === 'dark'
                      ? 'bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Shield className="w-4 h-4" /> SLA Dispatch
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'leaderboard'}
                onClick={() => { setActiveTab('leaderboard'); setMobileMenuOpen(false); }}
                className={`w-full text-xs font-bold py-3 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                  activeTab === 'leaderboard'
                    ? 'bg-indigo-600 text-white shadow-lg border border-indigo-500/50'
                    : theme === 'dark'
                      ? 'bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Trophy className="w-4 h-4" /> Hero Center
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'dashboard'}
                onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                className={`w-full text-xs font-bold py-3 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-lg border border-indigo-500/50'
                    : theme === 'dark'
                      ? 'bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" /> SLA Analytics
              </button>
            </nav>
          </div>

          <div className="pt-6 border-t border-white/10">
            {currentUser && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  <span className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{currentUser.name}</span>
                </div>
                <button
                  onClick={() => { handleToggleRole(); setMobileMenuOpen(false); }}
                  className="w-full text-[10px] font-black uppercase tracking-wider py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-500/20"
                >
                  <Layers className="w-3.5 h-3.5" /> Toggle Identity
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------ NAVIGATION HEADER ------------------ */}
      <header className="relative z-10 max-w-7xl mx-auto px-4 pt-6">
        <div className={`flex justify-between items-center py-5 px-6 rounded-2xl shadow-xl backdrop-blur-md border transition-all ${
          theme === 'dark'
            ? 'bg-white/5 border-white/10 shadow-black/40'
            : 'bg-white/70 border-white/50 shadow-slate-200/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold tracking-tight font-display transition-colors ${
                theme === 'dark' ? 'text-white' : 'text-slate-800'
              }`}>
                Community Hero
              </h1>
              <p className={`text-xs font-semibold uppercase tracking-widest ${
                theme === 'dark' ? 'text-blue-400' : 'text-indigo-600'
              }`}>
                Civic Intelligence Engine
              </p>
            </div>
          </div>

          {/* Hamburger Menu Trigger for Mobile */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`xl:hidden p-2.5 rounded-xl border transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
            }`}
            aria-label="Open Navigation Drawer"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Navigation tabs with full WAI-ARIA tablist semantics (Hidden on mobile) */}
          <nav role="tablist" aria-label="Civic Navigation Tabs" className="hidden xl:flex gap-2">
            <button
              role="tab"
              aria-selected={activeTab === 'map'}
              aria-label="Explore Radar Map Tab"
              onClick={() => setActiveTab('map')}
              className={`text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <Map className="w-4 h-4" /> Explore Radar
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'feed'}
              aria-label="Civic Incident Feed Tab"
              onClick={() => setActiveTab('feed')}
              className={`text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'feed'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <FileText className="w-4 h-4" /> Civic Feed
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'report'}
              aria-label="Report New Hazard Tab"
              onClick={() => setActiveTab('report')}
              className={`text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Report Hazard
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'authority'}
              aria-label="SLA Dispatch Console Tab"
              onClick={() => setActiveTab('authority')}
              className={`text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'authority'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <Shield className="w-4 h-4" /> SLA Dispatch
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'leaderboard'}
              aria-label="Hero Leaderboard Center Tab"
              onClick={() => setActiveTab('leaderboard')}
              className={`text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <Trophy className="w-4 h-4" /> Hero Center
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'dashboard'}
              aria-label="SLA Analytics Dashboard Tab"
              onClick={() => setActiveTab('dashboard')}
              className={`text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                  : theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-xs'
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
                      issues={issues}
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
                        issues={issues}
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
                        issues={issues}
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
                  <SlaDashboard issues={issues} usersList={usersList} theme={theme} />
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
 
    </div>
  );
}
