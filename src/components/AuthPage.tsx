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
  const [securityQuestion, setSecurityQuestion] = useState('What was your childhood nickname?');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [fetchedQuestion, setFetchedQuestion] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [recoveryMethod, setRecoveryMethod] = useState<'question' | 'otp' | 'link'>('otp');
  const [resetToken, setResetToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [realEmailAvailable, setRealEmailAvailable] = useState<boolean | null>(null);
  const [simulatedEmails, setSimulatedEmails] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastEmailCount, setLastEmailCount] = useState(0);
  const isSubmittingRef = useRef(false);

  const fetchSimulatedEmails = () => {
    fetch('/api/auth/simulated-emails')
      .then(res => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then(data => {
        setSimulatedEmails(data);
        if (data.length > lastEmailCount) {
          setLastEmailCount(data.length);
          setDrawerOpen(true);
        }
      })
      .catch(err => {
        console.warn('Silent fallback: simulated emails not loaded.', err);
      });
  };

  useEffect(() => {
    fetchSimulatedEmails();
    const interval = setInterval(fetchSimulatedEmails, 3000);
    return () => clearInterval(interval);
  }, [lastEmailCount]);

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
          setRecoveryMethod('link');
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
    setSecurityAnswer('');
    setOtpCode('');
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
            securityQuestion,
            securityAnswer
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
      if (resetStep === 2) {
        if (newPassword.length < 6) {
          setError('New password should be at least 6 characters.');
          return;
        }
        if (newPassword !== confirmPassword) {
          setError('Passwords do not match. Please verify both fields.');
          return;
        }
      }

      if (recoveryMethod === 'question') {
        if (resetStep === 1) {
          const res = await fetch('/api/auth/forgot-password-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim() }),
          });

          const data = await res.json();
          if (!res.ok) {
            setError(data.error || 'Failed to fetch security question.');
            return;
          }

          setFetchedQuestion(data.question);
          setResetStep(2);
        } else {
          if (!securityAnswer.trim()) {
            setError('Please enter your security answer.');
            return;
          }
          if (newPassword.length < 6) {
            setError('New password should be at least 6 characters.');
            return;
          }

          const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              securityAnswer: securityAnswer.trim(),
              newPassword
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            setError(data.error || 'Failed to reset password.');
            return;
          }

          setSuccessMessage('Password reset successfully! Please log in with your new password.');
          setIsResetMode(false);
          setIsLogin(true);
          setNewPassword('');
          setConfirmPassword('');
          setSecurityAnswer('');
        }
      } else if (recoveryMethod === 'otp') {
        if (resetStep === 1) {
          const res = await fetch('/api/auth/send-reset-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), method: 'otp' }),
          });

          const data = await res.json();
          if (!res.ok) {
            setError(data.error || 'Failed to send verification code.');
            return;
          }

          setSuccessMessage(data.message);
          setResetStep(2);
        } else {
          if (!otpCode.trim()) {
            setError('Please enter the 6-digit verification code.');
            return;
          }
          if (newPassword.length < 6) {
            setError('New password should be at least 6 characters.');
            return;
          }

          const res = await fetch('/api/auth/reset-password-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              code: otpCode.trim(),
              newPassword
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            setError(data.error || 'Failed to reset password. Please verify your OTP code.');
            return;
          }

          setSuccessMessage('Password updated successfully! Please log in with your new password.');
          setIsResetMode(false);
          setIsLogin(true);
          setNewPassword('');
          setConfirmPassword('');
          setOtpCode('');
        }
      } else if (recoveryMethod === 'link') {
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
          // For magic link, we do NOT automatically switch to step 2 because they must click the link!
          // We stay on step 1.
        } else {
          // They are already verifying their token resetting password!
          if (newPassword.length < 6) {
            setError('New password should be at least 6 characters.');
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
      }
    } catch (err: any) {
      console.error('Reset Error:', err);
      if (!isLocalMode && err.code) {
        let msg = err.message || 'Failed to dispatch password reset email.';
        if (err.code === 'auth/user-not-found') {
          msg = 'No registered account found with this email address.';
        } else if (err.code === 'auth/invalid-email') {
          msg = 'Please enter a valid email address.';
        }
        setError(msg);
      } else {
        setError('🌐 Network error - could not reset password.');
      }
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
                  ? '🔒 Password Recovery (Step 1 of 2)' 
                  : `🔐 Set New Password (${recoveryMethod === 'otp' ? 'OTP Verification' : recoveryMethod === 'link' ? 'Secure Link' : 'Security Question'})`}
              </h2>
              <p className="text-[11px] text-gray-400 mt-1">
                {resetStep === 1 
                  ? "Choose a recovery method below and enter your registered email." 
                  : "Please supply your verification details and a strong new password."}
              </p>
            </div>

            {/* Recovery Method Selection tabs (Step 1 only) */}
            {resetStep === 1 && (
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-2">
                <button
                  type="button"
                  onClick={() => { setRecoveryMethod('otp'); setError(null); setSuccessMessage(null); }}
                  className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    recoveryMethod === 'otp'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>OTP Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setRecoveryMethod('link'); setError(null); setSuccessMessage(null); }}
                  className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    recoveryMethod === 'link'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Magic Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setRecoveryMethod('question'); setError(null); setSuccessMessage(null); }}
                  className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    recoveryMethod === 'question'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Question</span>
                </button>
              </div>
            )}

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
                {recoveryMethod === 'link' && (
                  <p className="text-[10px] text-indigo-400/80 mt-1.5 flex items-start gap-1">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>A single-use login link will be generated. You can click it in the Developer Drawer below to reset instantly.</span>
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Method Specific Step 2 UI */}
                {recoveryMethod === 'question' && (
                  <>
                    <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/20 text-xs text-gray-200 shadow-inner mb-3">
                      <span className="font-bold text-indigo-400 block mb-1">Your Security Question:</span>
                      <p className="italic text-gray-300 font-medium">"{fetchedQuestion}"</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        Security Answer
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter your security answer"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        className="w-full text-sm px-4 py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </>
                )}

                {recoveryMethod === 'otp' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Enter 6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      placeholder="e.g. 123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[0.5em] text-lg font-bold py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 flex items-start gap-1">
                      <Info className="w-3 h-3 shrink-0 mt-0.5 text-indigo-400" />
                      <span>Check the 📨 Developer Drawer below to find your generated code instantly.</span>
                    </p>
                  </div>
                )}

                {recoveryMethod === 'link' && (
                  <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Secure Link verified for <strong>{email}</strong></span>
                  </div>
                )}

                {/* New Password input for all Step 2 flows */}
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
                      ? (recoveryMethod === 'otp' ? 'Send OTP Code' : recoveryMethod === 'link' ? 'Send Reset Link' : 'Verify Email') 
                      : 'Reset Password & Sign In'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              {resetStep === 2 && recoveryMethod !== 'link' && (
                <button
                  type="button"
                  onClick={() => { setResetStep(1); setError(null); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-semibold transition-all"
                >
                  ← Back to Step 1
                </button>
              )}
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
              <>
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

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Security Question (For Recovery)
                  </label>
                  <select
                    value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)}
                    className="w-full text-sm px-4 py-3 rounded-xl border border-white/10 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
                  >
                    <option value="What was your childhood nickname?">What was your childhood nickname?</option>
                    <option value="What was the name of your first pet?">What was the name of your first pet?</option>
                    <option value="In which city were you born?">In which city were you born?</option>
                    <option value="What was the name of your primary school?">What was the name of your primary school?</option>
                    <option value="What is your favorite food?">What is your favorite food?</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Security Answer
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Provide answer for password resets"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    className="w-full text-sm px-4 py-3 rounded-xl border border-white/10 bg-slate-950 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </>
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

      {/* Developer Sandbox Drawer */}
      {!inline && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a]/95 border-t border-indigo-500/30 shadow-[0_-8px_30px_rgb(0,0,0,0.5)] backdrop-blur-md transition-all duration-300">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="w-full px-6 py-3 flex items-center justify-between text-left text-white hover:bg-white/5 cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold tracking-wider uppercase">
                  📨 Developer Outbox Sandbox
                </span>
                {simulatedEmails.length > 0 && (
                  <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {simulatedEmails.length}
                  </span>
                )}
              </div>
              <span className="text-xs text-indigo-400 font-semibold hover:underline">
                {drawerOpen ? 'Hide Panel' : 'Show Outgoing Mail'}
              </span>
            </button>

            {/* Collapsible Content */}
            {drawerOpen && (
              <div className="px-6 pb-6 max-h-[300px] overflow-y-auto space-y-4 border-t border-white/5 pt-4 custom-scrollbar">
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Real-time transactional log of outgoing password reset links, OTP verification codes, and security messages.
                </p>

                {simulatedEmails.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 text-center text-xs text-gray-500">
                    No simulated emails captured yet in this session.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {simulatedEmails.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/20 shadow-md relative overflow-hidden text-left"
                      >
                        <div className="absolute top-0 right-0 bg-indigo-500/10 text-indigo-400 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-[11px] text-indigo-300 font-bold mb-1">
                          Subject: {item.subject}
                        </div>
                        <div className="text-[10px] text-gray-400 mb-2 font-mono">
                          To: {item.email}
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded-lg text-[11px] text-gray-300 font-mono whitespace-pre-wrap leading-relaxed border border-white/5 mb-2 select-all">
                          {item.body}
                        </div>
                        <div className="flex gap-2">
                          {item.code && (
                            <button
                              type="button"
                              onClick={() => {
                                setOtpCode(item.code);
                                setSuccessMessage(`Copied verification code ${item.code} to input!`);
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-all cursor-pointer"
                            >
                              Auto-Fill Code: {item.code}
                            </button>
                          )}
                          {item.link && (
                            <a
                              href={item.link}
                              onClick={(e) => {
                                window.location.href = item.link;
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-all inline-block"
                            >
                              Follow Reset Link
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
