import { useState, FormEvent, ReactNode, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, Mail, Lock, User, AlertTriangle, 
  Loader2, Shield, ArrowRight, Eye, EyeOff,
  KeyRound, CheckCircle2, RefreshCw, Trash2, Info, Inbox, ExternalLink
} from 'lucide-react';
import { auth, isLocalMode } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendPasswordResetEmail 
} from 'firebase/auth';

interface AuthPageProps {
  onAuthSuccess: () => void;
  inline?: boolean;
}

export default function AuthPage({ onAuthSuccess, inline }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReactNode | null>(null);
  const [successMessage, setSuccessMessage] = useState<ReactNode | null>(null);

  // New recovery states
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [resetToken, setResetToken] = useState('');
  const [realEmailAvailable, setRealEmailAvailable] = useState<boolean | null>(null);
  const isSubmittingRef = useRef(false);

  // Fetch email service availability
  useEffect(() => {
    fetch('/api/auth/email-config-status')
      .then(res => res.json())
      .then(data => {
        setRealEmailAvailable(data.realEmailAvailable);
      })
      .catch(err => {
        console.error('Failed to fetch email config status:', err);
        setRealEmailAvailable(false);
      });
  }, []);

  // Extract reset token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenParam }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || 'The secure password reset link is invalid or has expired.');
            return;
          }
          
          setEmail(data.email);
          setIsResetMode(true);
          setResetStep(2);
          setResetToken(tokenParam);
          setSuccessMessage('🔗 Secure password reset link verified! Please set your new password below.');
        })
        .catch(err => {
          console.error('Error verifying token:', err);
          setError('🌐 Failed to verify secure reset link. Connection error.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  const handleForgotPassword = () => {
    setError(null);
    setSuccessMessage(null);
    setIsResetMode(true);
    setResetStep(1);
    setNewPassword('');
  };

  const handleInitialSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;
    if (!isLogin && !displayName.trim()) {
      setError('Please enter your full name to register.');
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin
        ? { email: email.trim(), password }
        : { 
            email: email.trim(), 
            password, 
            name: displayName.trim(),
            securityQuestion: 'Omitted',
            securityAnswer: 'omitted'
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please try again.');
        return;
      }

      // Success — persist session and notify parent
      if (data.user) {
        localStorage.setItem('civic_hero_session', JSON.stringify(data.user));
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError('🌐 Network error — could not reach the authentication server. Make sure the dev server is running.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (resetStep === 1) {
        const res = await fetch('/api/auth/send-reset-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), method: 'link' }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to dispatch secure link.');
          return;
        }

        setSuccessMessage(data.message);
      } else {
        if (newPassword.length < 6) {
          setError('New password should be at least 6 characters.');
          return;
        }
        if (newPassword !== confirmPassword) {
          setError('Passwords do not match. Please verify both fields.');
          return;
        }

        const res = await fetch('/api/auth/reset-password-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: resetToken,
            newPassword
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to reset password using token.');
          return;
        }

        setSuccessMessage('Password updated successfully! Please log in with your new password.');
        // Remove query param from url so it doesn't trigger the reset token modal on page refresh
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());
        setIsResetMode(false);
        setIsLogin(true);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      console.error('Reset Error:', err);
      setError('🌐 Network error - could not reset password.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
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
            Samadhan Setu
          </h1>
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mt-1">
            Civic Intelligence Engine
          </p>
        </div>

        {/* Tab Selector */}
        {!isResetMode && (
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
        )}

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

        {isResetMode ? (
          <form onSubmit={handleResetSubmit} className="space-y-4 animate-fadeIn">
            <div className="text-center mb-2">
              <h2 className="text-sm font-bold text-indigo-400">
                {resetStep === 1 
                  ? '🔒 Password Recovery' 
                  : '🔐 Set New Password'}
              </h2>
              <p className="text-[11px] text-gray-400 mt-1">
                {resetStep === 1 
                  ? "Enter your registered email address to receive a secure reset link." 
                  : "Please supply a strong new password below."}
              </p>
            </div>

            {resetStep === 1 ? (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Registered Email Address
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
            ) : (
              <>
                <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Secure Link verified for <strong>{email}</strong></span>
                </div>

                {/* New Password input */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Choose New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-gray-500" />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full text-sm pl-10 pr-10 py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password input */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-gray-500" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full text-sm pl-10 pr-10 py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <>
                  <span>
                    {resetStep === 1 
                      ? 'Send Reset Link' 
                      : 'Reset Password & Sign In'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => { setIsResetMode(false); setError(null); setSuccessMessage(null); }}
                className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-semibold transition-all ml-auto"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleInitialSubmit} className="space-y-4">
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
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm pl-10 pr-10 py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {isLogin && (
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
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
        )}

        {/* Footer info */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-gray-500 text-center">
          <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>Local credentials secured by Firestore & Node Crypto</span>
        </div>
      </motion.div>
    </div>
  );
}
