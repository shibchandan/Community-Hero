import { useState, FormEvent, ReactNode } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { motion } from 'motion/react';
import { 
  Sparkles, Mail, Lock, User, LogIn, AlertTriangle, 
  Loader2, Globe, Shield, ArrowRight 
} from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: () => void;
  inline?: boolean;
}

export default function AuthPage({ onAuthSuccess, inline }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReactNode | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address in the field below first, then click "Forgot Password?".');
      setSuccessMessage(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage(`A secure password reset link has been successfully dispatched to ${email}. Please check your inbox.`);
    } catch (err: any) {
      console.error('Password reset error:', err);
      let friendlyMessage = err.message;
      if (err.code === 'auth/user-not-found') {
        friendlyMessage = 'No registered citizen profile was found matching this email address.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = 'The email address format is invalid.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyMessage = 'Too many requests. Please try again later.';
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // Sync the authenticated Firebase user with our Express backend database
  const syncWithBackend = async (firebaseUser: any, nameToUse?: string) => {
    try {
      const response = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: nameToUse || firebaseUser.displayName || firebaseUser.email.split('@')[0],
          role: 'citizen'
        })
      });
      if (!response.ok) {
        throw new Error('Failed to synchronize user profile with backend services.');
      }
    } catch (err: any) {
      console.error('Backend sync error:', err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isLogin) {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to sign in.');
        }
      } else {
        if (!displayName.trim()) {
          throw new Error('Please enter your full name to register.');
        }
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: displayName })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to register account.');
        }
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      await syncWithBackend(userCredential.user);
      onAuthSuccess();
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        const projectId = auth.app.options.projectId || 'analytical-scout-vqvh5';
        setError(
          <div className="space-y-2 text-xs text-left w-full">
            <p className="font-bold text-red-400">Google Sign-In is Disabled</p>
            <p className="text-gray-300 leading-normal">
              The <strong>Google</strong> authentication provider is not enabled in your Firebase console.
            </p>
            <div className="p-3 bg-black/30 rounded-lg border border-red-500/10 space-y-1.5 text-gray-400">
              <p className="font-bold text-gray-300">How to enable it:</p>
              <p>1. Open your <a href={`https://console.firebase.google.com/project/${projectId}/authentication/providers`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-bold">Firebase Auth Console ↗</a>.</p>
              <p>2. Under the <strong>Sign-in method</strong> tab, click <strong>"Add new provider"</strong>.</p>
              <p>3. Select <strong>"Google"</strong> and switch the <strong>Enable</strong> toggle ON, then click <strong>Save</strong>.</p>
            </div>
          </div>
        );
      } else {
        // Fallback or warning if in a nested iframe where popups are blocked
        setError(
          err.message?.includes('popup-blocked') || err.code === 'auth/popup-blocked-by-browser'
            ? 'Google Authentication popup was blocked. Please open the app in a new tab using the button in the top right, or register with Email & Password instead.'
            : err.message || 'Failed to authenticate via Google.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={inline ? "" : "min-h-screen bento-bg flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden"}>
      {!inline && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[20%] left-[25%] w-[450px] h-[450px] rounded-full bg-indigo-500/10 blur-[130px]" />
          <div className="absolute bottom-[20%] right-[25%] w-[450px] h-[450px] rounded-full bg-purple-500/10 blur-[130px]" />
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`relative z-10 w-full max-w-md p-8 rounded-2xl bento-card border border-white/10 ${inline ? 'bg-[#0f172a]' : 'shadow-2xl'}`}
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold font-display text-white tracking-tight">
            Community Hero
          </h1>
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mt-1">
            Civic Intelligence Engine
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-white/5 p-1 mb-6 border border-white/10">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(null); setSuccessMessage(null); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isLogin 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(null); setSuccessMessage(null); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !isLogin 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </motion.div>
        )}

        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-start gap-2.5 animate-fadeIn"
          >
            <span className="text-base shrink-0">✉️</span>
            <span className="leading-relaxed">{successMessage}</span>
          </motion.div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Aarav Sharma"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full text-sm pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="w-4 h-4 text-gray-500" />
              </div>
              <input
                type="email"
                required
                placeholder="sarah.j@civic.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-gray-500" />
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            {isLogin && (
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessMessage("Since this app uses a custom database authentication store to bypass Starter Tier console limits, password recovery is simplified. If you forget your password, you can register a new account with any email to reset/start fresh.");
                    setError(null);
                  }}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer transition-all"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              <>
                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className={`px-3 text-gray-500 font-bold ${inline ? 'bg-slate-900' : 'bg-[#05060b]'}`}>Or Continue With</span>
          </div>
        </div>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign In with Google</span>
        </button>

        {/* Footer info */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-gray-500 text-center">
          <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>Local credentials secured by Firestore & Node Crypto</span>
        </div>
      </motion.div>
    </div>
  );
}
