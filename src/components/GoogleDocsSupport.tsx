/**
 * GoogleDocsSupport Component
 * Enables seamless integration with Google Docs and Google Drive APIs.
 * Supports:
 * - Google Sign-in with Docs/Drive scopes
 * - One-click generation of Hackathon Project Description Document based on the selected problem statement
 * - Real-time listing of the user's community docs from Google Drive
 * - Exporting individual verified issue reports as professional civic documents
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Search, ExternalLink, Plus, RefreshCw, 
  Check, Loader2, AlertTriangle, LogOut, ArrowRight,
  BookOpen, Info, ShieldAlert, FileSignature
} from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Issue } from '../types';

interface Props {
  theme: 'dark' | 'light';
  issues: Issue[];
}

interface GoogleDocFile {
  id: string;
  name: string;
  webViewLink: string;
  modifiedTime: string;
}

// In-memory token cache to prevent loss on fast re-renders
let cachedAccessToken: string | null = null;
let cachedGoogleUser: any = null;

export default function GoogleDocsSupport({ theme, issues }: Props) {
  const [accessToken, setAccessToken] = useState<string | null>(cachedAccessToken);
  const [googleUser, setGoogleUser] = useState<any>(cachedGoogleUser);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Docs list states
  const [docs, setDocs] = useState<GoogleDocFile[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [docsError, setDocsError] = useState<string | null>(null);

  // Exporter states
  const [isExportingProject, setIsExportingProject] = useState(false);
  const [lastCreatedDoc, setLastCreatedDoc] = useState<GoogleDocFile | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [selectedIssueId, setSelectedIssueId] = useState<string>('');
  const [isExportingIssue, setIsExportingIssue] = useState(false);

  // Initialize from cache on mount
  useEffect(() => {
    if (cachedAccessToken && cachedGoogleUser) {
      setAccessToken(cachedAccessToken);
      setGoogleUser(cachedGoogleUser);
      fetchGoogleDocs(cachedAccessToken);
    }
  }, []);

  // Handle Google OAuth Sign-in
  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      // Add required scopes
      googleProvider.addScope('https://www.googleapis.com/auth/documents');
      googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
      googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (!credential || !credential.accessToken) {
        throw new Error('Could not obtain OAuth access token from Google.');
      }

      const token = credential.accessToken;
      cachedAccessToken = token;
      cachedGoogleUser = result.user;

      setAccessToken(token);
      setGoogleUser(result.user);
      fetchGoogleDocs(token);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setAuthError(err.message || 'Authentication failed. Please verify popup permissions.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDisconnect = () => {
    cachedAccessToken = null;
    cachedGoogleUser = null;
    setAccessToken(null);
    setGoogleUser(null);
    setDocs([]);
    setLastCreatedDoc(null);
  };

  // Fetch Google Docs from the user's Drive
  const fetchGoogleDocs = async (token: string) => {
    setIsLoadingDocs(true);
    setDocsError(null);
    try {
      // Search for Google Docs in Google Drive
      const query = "mimeType='application/vnd.google-apps.document'";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&pageSize=15&fields=files(id,name,webViewLink,modifiedTime)`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired, clear auth
          handleDisconnect();
          throw new Error('Google session expired. Please sign in again.');
        }
        throw new Error('Failed to retrieve files from Google Drive.');
      }

      const data = await res.json();
      setDocs(data.files || []);
    } catch (err: any) {
      console.error('Fetch Docs Error:', err);
      setDocsError(err.message || 'Failed to list Google Docs.');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Create a blank Google Doc and populate it bottom-up
  const createAndPopulateDoc = async (title: string, requests: any[]) => {
    if (!accessToken) return null;

    // 1. Create a blank Google Doc
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create Google Doc: ${createRes.statusText}`);
    }

    const docData = await createRes.json();
    const documentId = docData.documentId;

    // 2. Perform Batch Update to write structure
    const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });

    if (!updateRes.ok) {
      throw new Error(`Failed to populate Google Doc: ${updateRes.statusText}`);
    }

    return {
      id: documentId,
      name: title,
      webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
      modifiedTime: new Date().toISOString()
    };
  };

  // ── Generates the official project description based on guidelines ──
  const generateHackathonDescriptionDoc = async () => {
    if (!accessToken) return;
    setIsExportingProject(true);
    setExportError(null);

    try {
      const title = 'Samadhan Setu - Hyperlocal Problem Solver (Project Description)';
      
      // Bottom-up construction to bypass position calculation
      const requests = [
        // End of Document spacing
        {
          insertText: {
            location: { index: 1 },
            text: "\n--- End of Submission Document ---\n"
          }
        },
        // Google Technologies Utilized Section
        {
          insertText: {
            location: { index: 1 },
            text: "6. GOOGLE TECHNOLOGIES UTILIZED\n" +
                  "• Google AI Studio & Gemini API: Leveraged server-side to analyze incoming reports, perform instant sentiment tagging, generate descriptive titles, suggest corresponding departments, and power our interactive conversational 'Civic Bot' assistant.\n" +
                  "• Firebase Firestore: Used as our highly scalable real-time database enabling instantaneous status updates, public comment synchronization, upvoting metrics, and live chat across citizen and officer panels.\n" +
                  "• Firebase Authentication: Secure onboarding via Google Account login and email credential setup.\n" +
                  "• Google Docs & Drive API: Direct workspace integration allowing citizens and officials to export report summaries, project descriptions, and validation briefs to cloud-based Google Docs.\n" +
                  "• Google Cloud Run: Scaled container hosting for both express server and Vite React static layers.\n\n"
          }
        },
        // Technologies Used Section
        {
          insertText: {
            location: { index: 1 },
            text: "5. TECHNOLOGIES USED\n" +
                  "• Frontend: React 18, Vite build configuration, Tailwind CSS for responsive styling, Framer Motion for premium fluid layouts, and Lucide React icons.\n" +
                  "• Backend: Node.js, Express framework, Cookie-parser, Helmet security middlewares.\n" +
                  "• Data Management: Firestore Database & REST Polling backup, Local Storage persistence.\n\n"
          }
        },
        // Key Features Section
        {
          insertText: {
            location: { index: 1 },
            text: "4. KEY FEATURES IMPLEMENTED\n" +
                  "• Explore Radar Map: Instant mapping of potholes, garbage piles, streetlight failures, and water leaks using responsive custom markers.\n" +
                  "• Automated AI Categorization: Intelligent analysis of submitted issues using natural language understanding to automatically route issues to departments and estimate resolution SLA durations.\n" +
                  "• Citizen Upvoting & Trust Engine: Transparent community verification mechanism that flags duplicates, locks verified cases, and increases reporter Trust Scores upon successful resolutions.\n" +
                  "• SLA Control Dashboard: Full-scale system dashboard for city authorities with dispatch tools, urgent priority logs, and automated notifications.\n" +
                  "• Verified Blockchain-style Ledger: Immutable public record log demonstrating civic transparency.\n" +
                  "• WhatsApp Integration simulation: Demo-ready messaging channel allowing citizens to report incidents from standard messaging apps.\n\n"
          }
        },
        // Solution Overview Section
        {
          insertText: {
            location: { index: 1 },
            text: "3. SOLUTION OVERVIEW\n" +
                  "Samadhan Setu acts as an intelligent, transparent bridge (Setu) between local citizens and civic authorities. When a citizen identifies a local issue (such as a water leak or broken streetlight), they quickly submit it on our platform. The platform uses Gemini-powered intelligence to automatically clean descriptions, route them to the proper city department, and assign an SLA deadline. Other citizens can see the issue on their interactive radar, upvote it to verify its presence, and discuss in real-time. Once the department resolves the issue, verified proof is posted, and the reporting citizen is rewarded with points and badges, elevating community engagement.\n\n"
          }
        },
        // Selected Problem Statement Section
        {
          insertText: {
            location: { index: 1 },
            text: "2. PROBLEM STATEMENT SELECTED\n" +
                  "Problem Statement Name: Community Hero - Hyperlocal Problem Solver\n" +
                  "Focus Areas: Fragmented civic reporting, broken communication channels between citizens and local bodies, lack of real-time transparency, and automated incident categorization.\n\n"
          }
        },
        // Meta Information Section
        {
          insertText: {
            location: { index: 1 },
            text: "1. SUBMISSION INFORMATION\n" +
                  `• Deployed App Link: ${window.location.origin}\n` +
                  `• Primary Applicant: shibchandan11@gmail.com\n` +
                  `• Event Name: Vibe2Ship Hackathon 2026\n` +
                  `• Generated On: ${new Date().toLocaleString()}\n\n`
          }
        },
        // Title & Header Separator
        {
          insertText: {
            location: { index: 1 },
            text: "========================================================================\n" +
                  "SAMADHAN SETU - HACKATHON PROJECT DESCRIPTION\n" +
                  "========================================================================\n\n"
          }
        }
      ];

      const newDoc = await createAndPopulateDoc(title, requests);
      if (newDoc) {
        setLastCreatedDoc(newDoc);
        // Refresh documents list
        fetchGoogleDocs(accessToken);
      }
    } catch (err: any) {
      console.error('Project Export Error:', err);
      setExportError(err.message || 'Failed to generate project description.');
    } finally {
      setIsExportingProject(false);
    }
  };

  // ── Exports a specific community issue report as a Google Doc ──
  const exportIssueReportDoc = async () => {
    if (!accessToken || !selectedIssueId) return;
    setIsExportingIssue(true);
    setExportError(null);

    const issue = issues.find(i => i.id === selectedIssueId);
    if (!issue) {
      setExportError('Selected issue not found.');
      setIsExportingIssue(false);
      return;
    }

    try {
      const title = `Civic Incident Report: ${issue.title} (ID: ${issue.id.slice(0, 8)})`;

      const requests = [
        {
          insertText: {
            location: { index: 1 },
            text: "\n--- Generated automatically by Samadhan Setu Google Workspace Integration ---\n"
          }
        },
        {
          insertText: {
            location: { index: 1 },
            text: `5. DISPATCH TIMELINE EVENTS\n` +
                  (issue.timeline.length > 0 
                    ? issue.timeline.map(t => `• [${new Date(t.timestamp).toLocaleDateString()}] ${t.title}: ${t.description}`).join('\n')
                    : 'No timeline events registered yet.') + '\n\n'
          }
        },
        {
          insertText: {
            location: { index: 1 },
            text: `4. RESOLUTION INFORMATION\n` +
                  `• Current Resolution Status: ${issue.status.toUpperCase()}\n` +
                  `• Assigned Department: ${issue.department || 'General Public Works'}\n` +
                  `• SLA Resolution Window: ${issue.slaDays} Days\n` +
                  `• Resolution Proof URL: ${issue.resolutionProofUrl || 'Pending'}\n` +
                  `• Resolution Notes: ${issue.resolutionNotes || 'No notes provided yet.'}\n\n`
          }
        },
        {
          insertText: {
            location: { index: 1 },
            text: `3. COMMUNITY VOTE METRICS\n` +
                  `• Valid/Upvotes: ${issue.upvotes} Votes\n` +
                  `• Invalid/Downvotes: ${issue.downvotes} Votes\n` +
                  `• Overall Severity Assessment: ${issue.severity.toUpperCase()}\n\n`
          }
        },
        {
          insertText: {
            location: { index: 1 },
            text: `2. LOCATION INFORMATION\n` +
                  `• Full Address: ${issue.location.address}\n` +
                  `• Neighborhood Area: ${issue.location.area}\n` +
                  `• City: ${issue.location.city}\n` +
                  `• Coordinates: Latitude ${issue.location.lat}, Longitude ${issue.location.lng}\n\n`
          }
        },
        {
          insertText: {
            location: { index: 1 },
            text: `1. INCIDENT SPECIFICS\n` +
                  `• Incident Title: ${issue.title}\n` +
                  `• Category: ${issue.category.toUpperCase()}\n` +
                  `• Reported By: ${issue.reportedByName || 'Anonymous Citizen'}\n` +
                  `• Creation Date: ${new Date(issue.createdAt).toLocaleString()}\n` +
                  `• Detailed Description: ${issue.description}\n\n`
          }
        },
        {
          insertText: {
            location: { index: 1 },
            text: "========================================================================\n" +
                  "OFFICIAL COMMUNITY RESOLUTION BRIEF\n" +
                  "========================================================================\n\n"
          }
        }
      ];

      const newDoc = await createAndPopulateDoc(title, requests);
      if (newDoc) {
        setLastCreatedDoc(newDoc);
        // Refresh documents list
        fetchGoogleDocs(accessToken);
      }
    } catch (err: any) {
      console.error('Issue Export Error:', err);
      setExportError(err.message || 'Failed to export civic report.');
    } finally {
      setIsExportingIssue(false);
    }
  };

  const filteredDocs = docs.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="google-docs-support-root" className="w-full max-w-6xl mx-auto space-y-6">
      
      {/* ── Sub Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight font-display bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Google Docs Hub
          </h1>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
            Create, manage, and synchronize hackathon deliverables and official reports on Google Drive.
          </p>
        </div>
        
        {accessToken && googleUser && (
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              theme === 'dark' ? 'bg-slate-900 border-white/10 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Connected as: {googleUser.email}</span>
            </div>
            
            <button
              onClick={handleDisconnect}
              className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold cursor-pointer transition border border-red-500/30 text-red-400 hover:bg-red-500/10`}
              title="Disconnect Google Account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>
        )}
      </div>

      {/* ── main content ── */}
      {!accessToken ? (
        /* --- Sign-in Screen --- */
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex flex-col items-center justify-center text-center p-10 rounded-2xl border ${
            theme === 'dark' ? 'bg-slate-950/40 border-white/10' : 'bg-white border-slate-200 shadow-xl'
          }`}
        >
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <FileText className="w-7 h-7 text-white" />
          </div>
          
          <h2 className="text-lg font-bold font-display tracking-tight">Connect with Google Workspace</h2>
          <p className={`text-xs max-w-md mt-2 mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            To submit your project description Google Doc and export official community briefs directly to your drive, securely sign in with Google Workspace.
          </p>

          <button
            onClick={handleGoogleSignIn}
            disabled={isAuthenticating}
            className="relative flex items-center justify-center gap-3 px-6 py-3 border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer disabled:opacity-50"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Connecting with Google...</span>
              </>
            ) : (
              <>
                {/* Custom Google Vector Icon */}
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>Authorize & Connect Google Docs</span>
              </>
            )}
          </button>

          {authError && (
            <div className="flex items-center gap-2 text-rose-500 text-xs mt-4 font-bold border border-rose-500/20 bg-rose-500/5 px-4 py-2 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}
        </motion.div>
      ) : (
        /* --- Dashboard Screen --- */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left / Middle: Actions & Creation Tools */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Hackathon Requirement Guidelines Card */}
            <div className={`p-5 rounded-2xl border ${
              theme === 'dark' ? 'bg-indigo-950/20 border-indigo-500/20 text-slate-100' : 'bg-indigo-50/40 border-indigo-100 text-slate-800'
            }`}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 mt-0.5">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-indigo-400">Submission Requirements</span>
                  <h3 className="text-sm font-black tracking-tight mt-1">Is your project following the hackathon guidelines?</h3>
                  <p className={`text-xs mt-1.5 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    To remain eligible for evaluation in <strong>Vibe2Ship</strong>, participants must submit a <strong>Google Doc Project Description Link</strong> detailing the selected problem statement, solution overview, key features, and Google Technologies used.
                  </p>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={generateHackathonDescriptionDoc}
                      disabled={isExportingProject}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-500/10 cursor-pointer disabled:opacity-50"
                    >
                      {isExportingProject ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating Google Doc...</span>
                        </>
                      ) : (
                        <>
                          <FileSignature className="w-3.5 h-3.5" />
                          <span>Generate Compliant Google Doc Description</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Individual Incident Report Exporter Card */}
            <div className={`p-5 rounded-2xl border ${
              theme === 'dark' ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-xl'
            } space-y-4`}>
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase text-cyan-400">Official Documentation</span>
                <h3 className="text-sm font-black tracking-tight mt-0.5">Export Civic Incident Report</h3>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
                  Generate an official Google Doc report containing all verification events, coordinates, SLA window and resolution notes for a specific community problem.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedIssueId}
                  onChange={(e) => setSelectedIssueId(e.target.value)}
                  className={`flex-1 px-3 py-2 text-xs font-semibold rounded-xl border outline-none ${
                    theme === 'dark' 
                      ? 'bg-slate-950 border-white/10 text-slate-200 focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600'
                  }`}
                >
                  <option value="" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>-- Choose an Incident to Export --</option>
                  {issues.map(issue => (
                    <option key={issue.id} value={issue.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'} style={{ backgroundColor: theme === 'dark' ? '#020617' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>
                      [{issue.category.toUpperCase()}] {issue.title} ({issue.status})
                    </option>
                  ))}
                </select>

                <button
                  onClick={exportIssueReportDoc}
                  disabled={isExportingIssue || !selectedIssueId}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isExportingIssue ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Export Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Success notification banner after generation */}
            <AnimatePresence>
              {lastCreatedDoc && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`p-4 rounded-2xl border flex items-start gap-3 bg-emerald-500/10 border-emerald-500/20 text-emerald-400`}
                >
                  <Check className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black">Document Created Successfully!</h4>
                    <p className="text-[11px] opacity-80 mt-1 truncate">
                      Document: <strong>{lastCreatedDoc.name}</strong> has been added to your Google Drive.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <a
                        href={lastCreatedDoc.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] font-black underline hover:opacity-80"
                      >
                        <span>Open Document</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => setLastCreatedDoc(null)}
                        className="text-[11px] opacity-60 hover:opacity-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {exportError && (
              <div className="p-4 rounded-2xl border flex items-center gap-3 bg-rose-500/10 border-rose-500/20 text-rose-400 text-xs font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}
          </div>

          {/* Right Column: Google Drive File Explorer list */}
          <div className="space-y-4">
            <div className={`p-5 rounded-2xl border ${
              theme === 'dark' ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-xl'
            } flex flex-col h-[420px]`}>
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-black tracking-tight">Google Drive Docs</h3>
                </div>
                <button
                  onClick={() => accessToken && fetchGoogleDocs(accessToken)}
                  disabled={isLoadingDocs}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-200 transition"
                  title="Reload Google Drive"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocs ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search community docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border outline-none ${
                    theme === 'dark' 
                      ? 'bg-slate-950 border-white/10 text-slate-200 focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600'
                  }`}
                />
              </div>

              {/* Documents List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {isLoadingDocs && docs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
                    <span className="text-[11px] text-slate-500">Connecting to Drive...</span>
                  </div>
                ) : docsError ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6 px-4">
                    <ShieldAlert className="w-6 h-6 text-rose-400 mb-2" />
                    <span className="text-[11px] text-rose-400 font-bold leading-relaxed">{docsError}</span>
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <FileText className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
                    <span className="text-[11px] text-slate-500">
                      {searchQuery ? 'No matching documents found.' : 'No Google Docs found on Drive.'}
                    </span>
                  </div>
                ) : (
                  filteredDocs.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition group hover:scale-[1.02] cursor-pointer ${
                        theme === 'dark' 
                          ? 'bg-slate-950/40 border-white/5 hover:bg-slate-900 hover:border-white/10 text-slate-200' 
                          : 'bg-slate-50 border-slate-100 hover:bg-slate-100/55 hover:border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black truncate group-hover:text-indigo-400 transition">
                          {doc.name}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          Edited {new Date(doc.modifiedTime).toLocaleDateString()}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition" />
                    </a>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
