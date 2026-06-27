import { useState, FormEvent, ReactNode, useEffect } from 'react';
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New recovery states
  const [securityQuestion, setSecurityQuestion] = useState('What was your childhood nickname?');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [fetchedQuestion, setFetchedQuestion] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [recoveryMethod, setRecoveryMethod] = useState<'question' | 'otp' | 'link'>('otp');
  const [resetToken, setResetToken] = useState('');
  const [otpCode, setOtpCode] = useState('');

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
    if (!isLogin && !displayName.trim()) {
      setError('Please enter your full name to register.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!isLocalMode) {
        if (isLogin) {
          // Standard Firebase Email/Password Sign-In
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } else {
          // Standard Firebase Email/Password Sign-Up
          const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
          if (userCredential.user) {
            await updateProfile(userCredential.user, { displayName: displayName.trim() });
            
            // Sync with backend database immediately to ensure displayName and profile is created
            await fetch('/api/auth/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: userCredential.user.uid,
                email: userCredential.user.email,
                name: displayName.trim(),
                role: 'citizen'
              })
            });
          }
        }
        onAuthSuccess();
        return;
      }

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
      if (!isLocalMode && err.code) {
        let msg = err.message || 'An authentication error occurred.';
        if (err.code === 'auth/email-already-in-use') {
          msg = 'This email is already registered. Please log in instead.';
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          msg = 'Incorrect email or password. Please verify your credentials.';
        } else if (err.code === 'auth/weak-password') {
          msg = 'The password is too weak. Please use at least 6 characters.';
        } else if (err.code === 'auth/invalid-email') {
          msg = 'Please enter a valid email address.';
        }
        setError(msg);
      } else {
        setError('🌐 Network error — could not reach the authentication server. Make sure the dev server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!isLocalMode) {
        if (recoveryMethod !== 'link') {
          setError(
            <div className="space-y-1.5 text-left p-3 bg-indigo-950/20 border border-indigo-500/30 rounded-lg text-xs">
              <p className="font-bold text-indigo-400">🔒 Live Password Reset Security</p>
              <p className="text-gray-300 leading-relaxed text-[11px]">In live Firebase mode, local OTP and security questions are disabled for your account protection.</p>
              <p className="text-gray-400 text-[11px]">👉 Please select <span className="text-white font-semibold">"Magic Link"</span> tab above to receive a real, secure password reset email in your inbox from Google Firebase.</p>
            </div>
          );
          return;
        }
        if (resetStep === 1) {
          if (!email.trim()) {
            setError('Please enter your registered email address.');
            return;
          }
          await sendPasswordResetEmail(auth, email.trim());
          setSuccessMessage('✉️ A real, secure password reset link has been successfully dispatched to your email by Google Firebase! Please check your inbox and spam folder.');
        } else {
          setError('Please click the secure reset link sent to your email to choose a new password.');
        }
        return;
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

          setSuccessMessage('Password reset successfully!');
          if (data.user) {
            localStorage.setItem('civic_hero_session', JSON.stringify(data.user));
          }
          onAuthSuccess();
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

          setSuccessMessage('Password updated successfully!');
          if (data.user) {
            localStorage.setItem('civic_hero_session', JSON.stringify(data.user));
          }
          onAuthSuccess();
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

          setSuccessMessage('Password updated successfully!');
          if (data.user) {
            localStorage.setItem('civic_hero_session', JSON.stringify(data.user));
          }
          onAuthSuccess();
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

      {/* Developer Sandbox Drawer - Only rendered in development/sandbox mode, never in production for security */}
      {!(import.meta as any).env?.PROD && (
        <DeveloperInbox 
          onUseResetToken={(tokenParam) => {
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
                  setError(data.error || 'The secure reset token is invalid.');
                  return;
                }
                
                setEmail(data.email);
                setIsResetMode(true);
                setRecoveryMethod('link');
                setResetStep(2);
                setResetToken(tokenParam);
                setSuccessMessage('🔗 Magic Reset link injected successfully! Enter your new password below.');
              })
              .catch(err => {
                console.error(err);
                setError('🌐 Failed to verify secure reset link.');
              })
              .finally(() => {
                setLoading(false);
              });
          }}
        />
      )}
    </div>
  );
}

// --- Developer Sandbox Inbox Drawer Component ---
function DeveloperInbox({ onUseResetToken }: { onUseResetToken: (token: string) => void }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/auth/simulated-notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching simulated notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleClear = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/clear-simulated-notifications', { method: 'POST' });
      setNotifications([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mt-6 rounded-2xl border border-indigo-500/20 bg-slate-900/90 text-white shadow-xl overflow-hidden backdrop-blur-md z-20">
      {/* Header */}
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-950 to-slate-900 border-b border-indigo-500/20 cursor-pointer hover:bg-slate-800/80 transition-all select-none"
      >
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="text-xs font-bold font-mono tracking-tight text-indigo-300">
            📨 Developer Sandbox Inbox
          </span>
          {notifications.length > 0 && (
            <span className="bg-indigo-500 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full text-white">
              {notifications.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); fetchNotifications(); }} 
            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-all cursor-pointer"
            title="Refresh Inbox"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); handleClear(); }} 
            disabled={loading || notifications.length === 0}
            className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-all cursor-pointer disabled:opacity-40"
            title="Clear Inbox"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <span className="text-[10px] font-bold text-gray-500">
            {isOpen ? 'Collapse ▲' : 'Expand ▼'}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="p-3 max-h-[220px] overflow-y-auto space-y-2 font-mono text-[11px] bg-slate-950/60 custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="text-center py-6 text-gray-500 italic space-y-1">
              <p>📬 Inbox is empty</p>
              <p className="text-[9px] text-gray-600">Trigger a password reset to see OTP codes & login links here instantly!</p>
            </div>
          ) : (
            notifications.map((n) => {
              const isExpanded = expandedId === n.id;
              const formattedTime = new Date(n.timestamp).toLocaleTimeString();
              return (
                <div 
                  key={n.id} 
                  className={`p-2.5 rounded-xl border transition-all ${
                    isExpanded 
                      ? 'bg-indigo-950/50 border-indigo-500/30 shadow-inner' 
                      : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : n.id)}
                    className="flex justify-between items-start cursor-pointer gap-2"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-indigo-300 truncate">To: {n.email}</p>
                      <p className="text-[10px] text-gray-400 font-medium truncate">{n.subject}</p>
                    </div>
                    <span className="text-[9px] text-gray-600 shrink-0 font-sans">{formattedTime}</span>
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-indigo-500/20 space-y-2 text-gray-300 whitespace-pre-wrap leading-relaxed select-text">
                      <p className="bg-slate-950 p-2 rounded-lg border border-white/5 font-mono select-all text-gray-300 font-medium text-[10px]">
                        {n.body}
                      </p>
                      
                      {n.code && (
                        <div className="flex items-center gap-2 bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                          <span className="text-[10px] font-bold text-indigo-300">OTP Code:</span>
                          <span className="bg-indigo-600 px-2 py-0.5 rounded text-white font-bold select-all tracking-wider text-[11px]">
                            {n.code}
                          </span>
                        </div>
                      )}

                      {n.link && (
                        <div className="flex flex-col gap-1.5 bg-slate-900 p-2 rounded-lg border border-white/10">
                          <span className="text-[10px] font-bold text-indigo-300">Magic Link Action:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const url = new URL(n.link);
                              const token = url.searchParams.get('token');
                              if (token) onUseResetToken(token);
                            }}
                            className="w-full text-center font-bold py-1 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Inject & Reset Instantly</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
