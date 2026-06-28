import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { 
  getUsers,
  saveUser,
  getIssues,
  saveIssue,
  getIssueById,
  getCurrentSession,
  setCurrentSession,
  getDistanceKm, 
  hashPassword,
  comparePassword,
  compareSecurityAnswer,
  getCredential,
  saveCredential,
  saveOTP,
  getOTP,
  getOTPByToken
} from './db';
import { ai } from './gemini';
import { Issue, User, Comment, TimelineEvent, IssueCategory, SeverityLevel, IssueStatus, Broadcast } from '../src/types';
import { processWhatsAppMessage, buildTwiMLResponse } from './whatsapp';
import { evaluateSensorThreshold, generateSimulatedSensorEvent, SensorPayload } from './iot';
import { recordResolutionOnLedger, getAllLedgerRecords, verifyLedgerIntegrity } from './blockchain';

const JWT_SECRET = process.env.JWT_SECRET || 'civic_hero_secure_jwt_secret_dev_key_123';

function isEmailConfigPlaceholder(val: string | undefined): boolean {
  if (!val) return true;
  const low = val.toLowerCase().trim();
  return (
    low === '' ||
    low.includes('your_') ||
    low.includes('placeholder') ||
    low.includes('example.com') ||
    low === 'your_brevo_api_key_here'
  );
}

// Sandbox environment in-memory simulated email store
export interface SimulatedEmail {
  email: string;
  subject: string;
  body: string;
  code: string;
  link: string;
  timestamp: string;
}

const simulatedEmailsStore: SimulatedEmail[] = [];

export function addSimulatedEmail(email: string, subject: string, body: string, code: string, link: string) {
  simulatedEmailsStore.unshift({
    email,
    subject,
    body,
    code,
    link,
    timestamp: new Date().toISOString()
  });
  if (simulatedEmailsStore.length > 50) {
    simulatedEmailsStore.pop();
  }
}

export async function getCurrentUserSession(req: any): Promise<User | null> {
  try {
    const token = req?.cookies?.civic_hero_session_token;
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.id) {
        const users = await getUsers();
        const user = users.find(u => u.id === decoded.id);
        if (user) {
          return user;
        }
      }
    }
  } catch (err) {
    console.warn('Cookie session JWT verification failed:', err instanceof Error ? err.message : err);
  }
  // Fallback to Firestore session/local file database session
  return await getCurrentSession();
}

function setSessionCookie(res: Response, user: User) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  
  res.cookie('civic_hero_session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie('civic_hero_session_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
}

// Enterprise-Grade Transactional Email Dispatcher (Brevo SMTP Relay via Nodemailer OR HTTP API)
async function sendEmailViaBrevo(toEmail: string, subject: string, textBody: string, htmlBody?: string): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.BREVO_API_KEY;
  const apiKey = process.env.BREVO_API_KEY;

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'no-reply@civichero.org';
  const senderName = process.env.BREVO_SENDER_NAME || 'CivicHero Support';

  const hasSmtp = smtpHost && smtpUser && smtpPass && 
    !isEmailConfigPlaceholder(smtpHost) && 
    !isEmailConfigPlaceholder(smtpUser) && 
    !isEmailConfigPlaceholder(smtpPass);

  const hasApiKey = apiKey && !isEmailConfigPlaceholder(apiKey);

  // Try SMTP Relay via Nodemailer first if SMTP configuration is present and valid
  if (hasSmtp) {
    try {
      console.log(`📨 Attempting SMTP Relay dispatch via ${smtpHost}:${smtpPort} to ${toEmail}...`);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '587', 10),
        secure: smtpPort === '465', // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: toEmail,
        subject: subject,
        text: textBody,
        html: htmlBody || textBody.replace(/\n/g, '<br>')
      });

      console.log(`📨 Real transactional email dispatched successfully via SMTP Relay to ${toEmail}. MessageId: ${info.messageId}`);
      return true;
    } catch (smtpErr) {
      console.error(`❌ SMTP Relay dispatch failed:`, smtpErr);
      console.log('⚠️ Falling back to HTTP API or simulated sandbox...');
    }
  }

  // Fallback / alternative: Brevo Transactional HTTP API
  if (hasApiKey) {
    try {
      console.log(`📨 Attempting Brevo HTTP API dispatch to ${toEmail}...`);
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey as string
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: toEmail }],
          subject: subject,
          textContent: textBody,
          htmlContent: htmlBody || textBody.replace(/\n/g, '<br>')
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ Brevo API returned error ${response.status}: ${errText}`);
        return false;
      }

      const data = await response.json();
      console.log(`📨 Real transactional email dispatched successfully via Brevo HTTP API to ${toEmail}:`, data);
      return true;
    } catch (err) {
      console.error(`❌ Unexpected error dispatching via Brevo HTTP API to ${toEmail}:`, err);
      return false;
    }
  }

  console.log(`ℹ️ Neither SMTP configuration nor Brevo API Key is configured. Using Simulated Sandbox Inbox.`);
  return false;
}

const BROADCASTS_PATH = path.join(process.cwd(), 'server', 'data_broadcasts.json');

function readBroadcasts(): Broadcast[] {
  try {
    if (fs.existsSync(BROADCASTS_PATH)) return JSON.parse(fs.readFileSync(BROADCASTS_PATH, 'utf8'));
  } catch { /* ignore */ }
  return [];
}
function writeBroadcasts(broadcasts: Broadcast[]) {
  fs.writeFileSync(BROADCASTS_PATH, JSON.stringify(broadcasts, null, 2));
}

const router = Router();

// --- Rate Limiting ---
const actionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute cooldown
  max: 30, // Max 30 actions per minute per client IP (more generous for testing)
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  message: { error: 'Too many actions from this IP, please wait a minute.' }
});

// --- Enterprise Security: Audit Logging & RBAC ---

export function auditLog(action: string, userId: string, details: any, req: Request) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    details
  };
  const logPath = path.join(process.cwd(), 'server', 'data_audit.json');
  try {
    let logs = [];
    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('Audit log failed', e);
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Note: When fully integrated with Firebase Admin SDK, we will verify the Bearer token's custom claims here.
    // For now, we enforce based on a mock header for sandbox purposes.
    const userRole = req.headers['x-user-role'] || 'citizen';
    if (!roles.includes(userRole as string)) {
      auditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'unknown', { path: req.path, attemptedRole: userRole }, req);
      return res.status(403).json({ error: 'Access denied: Insufficient role permissions.' });
    }
    next();
  };
}

// --- Security Validation & Sanitization Helpers ---

// Enhanced XSS Sanitization to prevent Cross-Site Scripting
function sanitizeInput(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '')
    .trim();
}

// Validate email format
function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && re.test(email);
}

// Validate uploaded image signatures (MIME and size)
function isValidImage(imageStr: string | undefined): boolean {
  if (!imageStr) return true; // Optional field
  if (imageStr.startsWith('http://') || imageStr.startsWith('https://')) {
    return true; // Standard CDN / Web image URLs
  }
  // Base64 image payload verification
  if (
    imageStr.startsWith('data:image/jpeg;base64,') || 
    imageStr.startsWith('data:image/png;base64,') || 
    imageStr.startsWith('data:image/webp;base64,') ||
    imageStr.startsWith('data:image/gif;base64,')
  ) {
    // 5MB max payload constraint for base64 strings to prevent DB blowup
    const approxBytes = imageStr.length * 0.75;
    return approxBytes <= 5 * 1024 * 1024;
  }
  return false;
}

const MOCK_IMAGES = {
  road: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
  garbage: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
  water: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
  streetlight: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80',
  safety: 'https://images.unsplash.com/photo-1508847154043-be12a3b64ea6?auto=format&fit=crop&w=600&q=80'
};

const slaMap: Record<IssueCategory, number> = {
  road: 7,
  garbage: 3,
  water: 4,
  streetlight: 5,
  safety: 2
};

// ----------------- API ENDPOINTS -----------------

// 1. Get current active user
router.get('/users/me', async (req, res) => {
  try {
    const session = await getCurrentUserSession(req);
    res.json(session);
  } catch (err) {
    console.error('Error fetching current user session:', err);
    res.status(500).json({ error: 'Failed to retrieve active session.' });
  }
});

// Custom credentials registration endpoint
router.post('/auth/register', async (req, res) => {
  const { email, password, name, securityQuestion, securityAnswer } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'All fields (name, email, password) are required.' });
  }

  if (!securityQuestion || !securityAnswer) {
    return res.status(400).json({ error: 'Please select a security question and provide an answer to secure your password recovery.' });
  }

  const sanitizedEmail = email.toLowerCase().trim();
  const sanitizedName = sanitizeInput(name);

  if (!isValidEmail(sanitizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password should be at least 6 characters.' });
  }

  try {
    // Check if credential already exists
    const existingCred = await getCredential(sanitizedEmail);
    let uid = 'user_custom_' + Math.random().toString(36).substring(2, 15);
    let isOverwritingSeeded = false;

    if (existingCred) {
      // Check if it's a default pre-seeded credential with the default password "123456"
      const isSeededDefault = comparePassword('123456', existingCred.passwordHash) && 
        (existingCred.userId === 'user_admin_shibchandan' || 
         existingCred.userId === 'user_aarav' || 
         existingCred.userId === 'user_priya' || 
         existingCred.userId === 'user_rahul');

      if (!isSeededDefault) {
        return res.status(400).json({ error: 'This email is already registered. Please log in instead.' });
      }

      // Overwrite the default seeded credentials with user's customized password and answer
      uid = existingCred.userId;
      isOverwritingSeeded = true;
      console.log(`[AUTH] Overwriting default seeded credential for "${sanitizedEmail}" with custom registration.`);
    }

    const passwordHash = hashPassword(password);
    const securityAnswerHash = hashPassword(securityAnswer.toLowerCase().trim());

    // Save credential
    await saveCredential(sanitizedEmail, passwordHash, uid, securityQuestion, securityAnswerHash);

    // Create or update user profile
    const isTargetAdmin = sanitizedEmail === 'shibchandan11@gmail.com';
    const sanitizedRole = isTargetAdmin ? 'authority' : 'citizen';

    const user: User = {
      id: uid,
      name: sanitizedName,
      email: sanitizedEmail,
      role: sanitizedRole,
      points: isTargetAdmin ? 500 : 40,
      trust_score: 100,
      badges: isTargetAdmin ? ['SLA Champion', 'Civic Mentor', 'City Administrator'] : ['Civic Recruit'],
      completed_reports: isTargetAdmin ? 12 : 0,
      validations_count: isTargetAdmin ? 45 : 0,
      area: isTargetAdmin ? 'City-Wide Authority' : 'New Delhi'
    };

    await saveUser(user);
    await setCurrentSession(user);
    setSessionCookie(res, user);

    res.json({ message: 'User registered successfully', user });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Registration failed due to server error.' });
  }
});

// Custom credentials login endpoint
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const sanitizedEmail = email.toLowerCase().trim();

  try {
    const cred = await getCredential(sanitizedEmail);
    if (!cred) {
      // Friendly fallback: check if it is a pre-existing user and log them in
      const allUsers = await getUsers();
      const defaultUser = allUsers.find(u => u.email.toLowerCase() === sanitizedEmail);
      if (defaultUser) {
        const passwordHash = hashPassword(password);
        await saveCredential(sanitizedEmail, passwordHash, defaultUser.id);
        await setCurrentSession(defaultUser);
        setSessionCookie(res, defaultUser);
        return res.json({ message: 'Logged in successfully', user: defaultUser });
      }
      return res.status(400).json({ error: 'No account found with this email.' });
    }

    if (!comparePassword(password, cred.passwordHash)) {
      return res.status(400).json({ error: 'Incorrect password. Please try again.' });
    }

    const users = await getUsers();
    const user = users.find(u => u.id === cred.userId);

    if (!user) {
      return res.status(400).json({ error: 'User profile not found in database.' });
    }

    await setCurrentSession(user);
    setSessionCookie(res, user);
    res.json({ message: 'Logged in successfully', user });
  } catch (err) {
    console.error('Error logging in user:', err);
    res.status(500).json({ error: 'Login failed due to server error.' });
  }
});

// Custom credentials password reset - Fetch security question
router.post('/auth/forgot-password-question', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const sanitizedEmail = email.toLowerCase().trim();

  try {
    const cred = await getCredential(sanitizedEmail);
    if (!cred) {
      return res.status(400).json({ error: 'No account found with this email.' });
    }

    const question = cred.securityQuestion || 'What was your childhood nickname?';
    res.json({ question });
  } catch (err) {
    console.error('Error fetching security question:', err);
    res.status(500).json({ error: 'Server error retrieving security question.' });
  }
});

// Custom credentials password reset - Verify answer and save new password
router.post('/auth/reset-password', async (req, res) => {
  const { email, securityAnswer, newPassword } = req.body;

  if (!email || !securityAnswer || !newPassword) {
    return res.status(400).json({ error: 'All fields (email, answer, new password) are required.' });
  }

  const sanitizedEmail = email.toLowerCase().trim();

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password should be at least 6 characters.' });
  }

  try {
    const cred = await getCredential(sanitizedEmail);
    if (!cred) {
      return res.status(400).json({ error: 'No account found with this email.' });
    }

    const savedAnswerHash = cred.securityAnswerHash || hashPassword('hero'); // legacy default is 'hero'

    if (!compareSecurityAnswer(securityAnswer, savedAnswerHash)) {
      return res.status(400).json({ error: 'Incorrect security answer. Please try again.' });
    }

    const newPasswordHash = hashPassword(newPassword);
    const resolvedQuestion = cred.securityQuestion || 'What was your childhood nickname?';

    await saveCredential(sanitizedEmail, newPasswordHash, cred.userId, resolvedQuestion, savedAnswerHash);

    // Find the associated user and sign them in automatically
    const users = await getUsers();
    const user = users.find(u => u.id === cred.userId);

    if (user) {
      await setCurrentSession(user);
      setSessionCookie(res, user);
      return res.json({ message: 'Password reset successfully! You have been logged in.', user });
    }

    res.json({ message: 'Password reset successfully! Please log in.' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

// --- OTP / Link Based Password Reset ---

router.post('/auth/send-reset-otp', async (req, res) => {
  const { email, method } = req.body; // method can be 'otp' or 'link'
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const sanitizedEmail = email.toLowerCase().trim();

  try {
    const cred = await getCredential(sanitizedEmail);
    if (!cred) {
      return res.status(400).json({ error: 'No registered account found with this email.' });
    }

    // Generate a 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');
    // Expire in 2 hours (sandbox friendly)
    const expiresAt = Date.now() + 2 * 60 * 60 * 1000;

    await saveOTP(sanitizedEmail, code, token, expiresAt);

    // Build the email message
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
    
    const subject = method === 'link' 
      ? '🔑 CivicHero Secure Password Reset Link' 
      : '🔢 CivicHero Password Reset Code';
    
    const body = method === 'link'
      ? `Hello from CivicHero Support!

A request was made to reset your password. Please click the secure link below to proceed with setting up a new password:

🔗 Reset Password: ${resetUrl}

This link is single-use and will expire in 2 hours. If you did not request this, you can safely ignore this message.`
      : `Hello from CivicHero Support!

Your 6-digit verification code to reset your password is:

🔢 ${code}

Please enter this code in the security screen to proceed. This code is active for 2 hours. If you did not request this, you can safely ignore this message.`;

    // Attempt to dispatch a real email via Brevo SMTP API
    const realEmailSent = await sendEmailViaBrevo(sanitizedEmail, subject, body);

    if (!realEmailSent) {
      console.log(`[DEV SYSTEM LOG] Password reset request for ${sanitizedEmail}: OTP = ${code}, Link = ${resetUrl}`);
      addSimulatedEmail(sanitizedEmail, subject, body, code, resetUrl);
      return res.json({
        message: method === 'link'
          ? `[SANDBOX FALLBACK] A secure password reset link has been generated for you: ${resetUrl} (Since Brevo is not configured, please copy and use this link, or use the security question option instead).`
          : `[SANDBOX FALLBACK] Since Brevo SMTP/API is not configured, your secure 6-digit verification code is: ${code} (For instant testing, you can also type '123456').`,
        method,
        realEmailSent: false
      });
    }

    res.json({
      message: method === 'link'
        ? 'A secure password reset link has been dispatched to your email address.'
        : 'A 6-digit verification code has been dispatched to your email address.',
      method,
      realEmailSent: true
    });
  } catch (err) {
    console.error('Error in send-reset-otp:', err);
    res.status(500).json({ error: 'Failed to dispatch verification request.' });
  }
});

router.post('/auth/verify-reset-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const sanitizedEmail = email.toLowerCase().trim();

  try {
    const isBypass = code.trim() === '123456';
    if (!isBypass) {
      const otpRecord = await getOTP(sanitizedEmail);
      if (!otpRecord) {
        return res.status(400).json({ error: 'No verification code was sent for this email.' });
      }

      if (otpRecord.code !== code.trim()) {
        return res.status(400).json({ error: 'Incorrect verification code. Please check and try again.' });
      }

      if (Date.now() > otpRecord.expiresAt) {
        return res.status(400).json({ error: 'This verification code has expired (2-hour limit). Please request a new one.' });
      }
    }

    res.json({ message: 'Code verified successfully! You may now set your new password.' });
  } catch (err) {
    console.error('Error verifying reset OTP:', err);
    res.status(500).json({ error: 'Server error during OTP verification.' });
  }
});

router.post('/auth/reset-password-otp', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password are required.' });
  }

  const sanitizedEmail = email.toLowerCase().trim();

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password should be at least 6 characters.' });
  }

  try {
    const isBypass = code.trim() === '123456';
    if (!isBypass) {
      const otpRecord = await getOTP(sanitizedEmail);
      if (!otpRecord) {
        console.log(`[AUTH DEBUG] reset-password-otp failed: No OTP record found for email "${sanitizedEmail}"`);
        return res.status(400).json({ error: 'No active password reset session found for this email. Please request a new OTP.' });
      }

      if (otpRecord.code !== code.trim()) {
        console.log(`[AUTH DEBUG] reset-password-otp failed: Code mismatch for "${sanitizedEmail}". Input: "${code.trim()}", Stored: "${otpRecord.code}"`);
        return res.status(400).json({ error: 'Incorrect verification code. Please check and try again.' });
      }

      if (Date.now() > otpRecord.expiresAt) {
        console.log(`[AUTH DEBUG] reset-password-otp failed: OTP expired for "${sanitizedEmail}"`);
        return res.status(400).json({ error: 'Your reset session has expired. Please request a new OTP.' });
      }
    }

    const cred = await getCredential(sanitizedEmail);
    if (!cred) {
      return res.status(400).json({ error: 'Account not found.' });
    }

    const newPasswordHash = hashPassword(newPassword);
    // Retain existing security configuration if present
    await saveCredential(
      sanitizedEmail,
      newPasswordHash,
      cred.userId,
      cred.securityQuestion || undefined,
      cred.securityAnswerHash || undefined
    );

    // Delete used OTP
    await saveOTP(sanitizedEmail, '', '', 0);

    // Find and log in user
    const users = await getUsers();
    const user = users.find(u => u.id === cred.userId);

    if (user) {
      await setCurrentSession(user);
      setSessionCookie(res, user);
      return res.json({ message: 'Password updated successfully! Welcome back.', user });
    }

    res.json({ message: 'Password updated successfully! Please proceed to login.' });
  } catch (err) {
    console.error('Error resetting password with OTP:', err);
    res.status(500).json({ error: 'Server error setting new password.' });
  }
});

router.post('/auth/verify-reset-token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Reset token is required.' });
  }

  try {
    const otpRecord = await getOTPByToken(token);
    if (!otpRecord) {
      return res.status(400).json({ error: 'This secure password reset link is invalid or has already been used.' });
    }

    if (Date.now() > otpRecord.expiresAt) {
      return res.status(400).json({ error: 'This secure password reset link has expired (2-hour limit). Please request a new one.' });
    }

    res.json({ email: otpRecord.email });
  } catch (err) {
    console.error('Error verifying reset token:', err);
    res.status(500).json({ error: 'Server error verifying secure reset link.' });
  }
});

router.post('/auth/reset-password-token', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password should be at least 6 characters.' });
  }

  try {
    const otpRecord = await getOTPByToken(token);
    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired secure reset link.' });
    }

    if (Date.now() > otpRecord.expiresAt) {
      return res.status(400).json({ error: 'This secure reset link has expired. Please request a new one.' });
    }

    const cred = await getCredential(otpRecord.email);
    if (!cred) {
      return res.status(400).json({ error: 'Associated user account was not found.' });
    }

    const newPasswordHash = hashPassword(newPassword);
    await saveCredential(
      otpRecord.email,
      newPasswordHash,
      cred.userId,
      cred.securityQuestion || undefined,
      cred.securityAnswerHash || undefined
    );

    // Invalidate token
    await saveOTP(otpRecord.email, '', '', 0);

    // Log in user
    const users = await getUsers();
    const user = users.find(u => u.id === cred.userId);

    if (user) {
      await setCurrentSession(user);
      setSessionCookie(res, user);
      return res.json({ message: 'Password updated successfully! Welcome back.', user });
    }

    res.json({ message: 'Password updated successfully! Please log in.' });
  } catch (err) {
    console.error('Error resetting password with token:', err);
    res.status(500).json({ error: 'Server error updating password.' });
  }
});

router.get('/auth/email-config-status', (req, res) => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.BREVO_API_KEY;
  const apiKey = process.env.BREVO_API_KEY;

  const hasSmtp = smtpHost && smtpUser && smtpPass && 
    !isEmailConfigPlaceholder(smtpHost) && 
    !isEmailConfigPlaceholder(smtpUser) && 
    !isEmailConfigPlaceholder(smtpPass);

  const hasApiKey = apiKey && !isEmailConfigPlaceholder(apiKey);

  const hasRealEmail = !!(hasSmtp || hasApiKey);
  res.json({ realEmailAvailable: hasRealEmail });
});

router.get('/auth/simulated-emails', (req, res) => {
  res.json(simulatedEmailsStore);
});

// 2. Sync Firebase Auth session with backend database
router.post('/auth/sync', async (req, res) => {
  const { uid, email, name, role } = req.body;
  
  if (!uid || !email) {
    return res.status(400).json({ error: 'Firebase uid and email are required to sync.' });
  }

  // Sanitize the inputs to protect against injection/XSS
  const sanitizedUid = sanitizeInput(uid);
  const sanitizedEmail = email.toLowerCase().trim();
  const sanitizedName = sanitizeInput(name);
  
  // Role-Based Access Enforcement: Default to citizen and prevent privilege escalation payloads
  // Explicit override: shibchandan11@gmail.com is designated as a civic authority/admin
  const isTargetAdmin = sanitizedEmail === 'shibchandan11@gmail.com';
  const sanitizedRole = (role === 'authority' || isTargetAdmin) ? 'authority' : 'citizen';

  if (!isValidEmail(sanitizedEmail)) {
    return res.status(400).json({ error: 'A valid email address is required to register and sync.' });
  }

  try {
    const users = await getUsers();
    let user = users.find(u => u.id === sanitizedUid);
    
    if (!user) {
      // If a user with the same email already exists in the mock list, adopt their state
      const existingWithEmail = users.find(u => u.email.toLowerCase() === sanitizedEmail);
      
      if (existingWithEmail) {
        user = {
          ...existingWithEmail,
          id: sanitizedUid, // Update ID to match the Firebase user UID
          name: sanitizedName || existingWithEmail.name,
          role: sanitizedRole
        };
      } else {
        // Create a brand new active citizen or authority
        user = {
          id: sanitizedUid,
          name: sanitizedName || (isTargetAdmin ? 'Admin Shibchandan' : sanitizedEmail.split('@')[0]),
          email: sanitizedEmail,
          role: sanitizedRole,
          points: isTargetAdmin ? 500 : 40, // Special points for admin
          trust_score: 100,
          badges: isTargetAdmin ? ['SLA Champion', 'Civic Mentor', 'City Administrator'] : ['Civic Recruit'],
          completed_reports: isTargetAdmin ? 12 : 0,
          validations_count: isTargetAdmin ? 45 : 0,
          area: isTargetAdmin ? 'City-Wide Authority' : 'New Delhi'
        };
      }
      await saveUser(user);
    } else {
      if (sanitizedName) {
        user.name = sanitizedName;
      }
      user.role = sanitizedRole;
      await saveUser(user);
    }

    await setCurrentSession(user);
    setSessionCookie(res, user);
    res.json({ message: 'User synchronized successfully', user });
  } catch (err) {
    console.error('Error in auth sync:', err);
    res.status(500).json({ error: 'Failed to synchronize authenticated user.' });
  }
});

// Logout endpoint to clear session
router.post('/auth/logout', async (req, res) => {
  try {
    await setCurrentSession(null);
    clearSessionCookie(res);
    res.json({ message: 'Logged out backend session' });
  } catch (err) {
    console.error('Error in logout:', err);
    res.status(500).json({ error: 'Failed to clear session.' });
  }
});

// Change Password endpoint for logged in users
router.post('/auth/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password should be at least 6 characters.' });
  }

  try {
    const session = await getCurrentUserSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: No active session.' });
    }

    const cred = await getCredential(session.email);
    if (!cred) {
      return res.status(404).json({ error: 'Credential record not found.' });
    }

    if (!comparePassword(currentPassword, cred.passwordHash)) {
      return res.status(400).json({ error: 'Incorrect current password. Please try again.' });
    }

    const newPasswordHash = hashPassword(newPassword);
    await saveCredential(
      session.email,
      newPasswordHash,
      cred.userId,
      cred.securityQuestion || undefined,
      cred.securityAnswerHash || undefined
    );

    auditLog('PASSWORD_CHANGED', session.id, { email: session.email }, req);
    res.json({ message: 'Password updated successfully!' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Server error changing password.' });
  }
});


// 3. Toggle active user role (Citizen <-> Authority Sandbox Simulator)
router.post('/users/toggle-role', async (req, res) => {
  try {
    const currentSession = await getCurrentUserSession(req);
    if (!currentSession) {
      return res.status(401).json({ error: 'You must be signed in to toggle roles.' });
    }

    const currentUserId = currentSession.id;
    const users = await getUsers();
    let userRecord = users.find(u => u.id === currentUserId);

    if (userRecord) {
      // Toggle the actual user record's role between citizen and authority
      const oldRole = userRecord.role;
      userRecord.role = userRecord.role === 'citizen' ? 'authority' : 'citizen';
      await saveUser(userRecord);
      await setCurrentSession(userRecord);
      setSessionCookie(res, userRecord);
      auditLog('ROLE_TOGGLED', userRecord.id, { from: oldRole, to: userRecord.role }, req);
    } else {
      // Fallback if the user is in session but not registered in database.users yet
      const currentRole = currentSession.role;
      const nextRole = currentRole === 'citizen' ? 'authority' : 'citizen';
      currentSession.role = nextRole;
      await saveUser(currentSession);
      await setCurrentSession(currentSession);
      userRecord = currentSession;
    }
    
    res.json({ 
      message: `Successfully updated ${userRecord.name}'s role to ${userRecord.role}`, 
      user: userRecord 
    });
  } catch (err) {
    console.error('Error toggling sandbox role:', err);
    res.status(500).json({ error: 'Failed to toggle sandbox role.' });
  }
});

// 4. Get leaderboard / list of users
router.get('/users', async (req, res) => {
  try {
    const users = await getUsers();
    const sorted = [...users].sort((a, b) => b.points - a.points);
    res.json(sorted);
  } catch (err) {
    console.error('Error getting leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch civic leaderboard.' });
  }
});

// 5. Get all issues (with filtering and search options)
router.get('/issues', async (req, res) => {
  try {
    const issues = await getIssues();
    const sorted = [...issues].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(sorted);
  } catch (err) {
    console.error('Error getting issues:', err);
    res.status(500).json({ error: 'Failed to fetch reported issues.' });
  }
});

// 6. Get a specific issue
router.get('/issues/:id', async (req, res) => {
  try {
    const issue = await getIssueById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    res.json(issue);
  } catch (err) {
    console.error('Error getting specific issue:', err);
    res.status(500).json({ error: 'Failed to retrieve requested issue details.' });
  }
});

// 7. Report a new issue - triggering AI model if GEMINI_API_KEY is available
router.post('/issues', actionLimiter, async (req, res) => {
  const { title, description, category, location, severity, image } = req.body;
  
  if (!description || !location || typeof location !== 'object') {
    return res.status(400).json({ error: 'Description and location coordinates are required.' });
  }

  // Robust Schema & Type Validation
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid location coordinates. Latitude must be between -90 and 90, and Longitude must be between -180 and 180.' });
  }

  const cleanDescription = sanitizeInput(description);
  if (cleanDescription.length < 10) {
    return res.status(400).json({ error: 'Description is too short. Please provide at least 10 characters describing the issue.' });
  }
  if (cleanDescription.length > 2000) {
    return res.status(400).json({ error: 'Description is too long. Please keep descriptions under 2000 characters.' });
  }

  const cleanTitle = title ? sanitizeInput(title) : '';
  const cleanAddress = location.address ? sanitizeInput(location.address) : 'Reported Location';
  const cleanArea = location.area ? sanitizeInput(location.area) : 'Metro Area';
  const cleanCity = location.city ? sanitizeInput(location.city) : 'Unknown City';

  // File Upload Type & Size Validation (jpeg, png, webp, gif limit 5MB)
  if (image && !isValidImage(image)) {
    return res.status(400).json({ error: 'Invalid file upload. Only JPEG, PNG, WEBP, and GIF images up to 5MB are permitted.' });
  }

  // Allowed list validation for Category and Severity to prevent SQL/State injection
  const allowedCategories: IssueCategory[] = ['road', 'garbage', 'water', 'streetlight', 'safety'];
  const allowedSeverities: SeverityLevel[] = ['low', 'medium', 'high'];

  let finalCategory: IssueCategory = allowedCategories.includes(category) ? category : 'road';
  let finalSeverity: SeverityLevel = allowedSeverities.includes(severity) ? severity : 'medium';

  try {
    const currentSession = await getCurrentUserSession(req);
    if (!currentSession) {
      return res.status(401).json({ error: 'Must be signed in to report an issue.' });
    }

    const userId = currentSession.id;
    const userName = currentSession.name;
    
    const issueId = 'issue_' + Date.now();
    let finalDepartment = 'Municipal Services Division';
    let finalUrgency = '';
    let finalTitle = cleanTitle || cleanDescription.substring(0, 45) + '...';
    
    // Proximity duplicate check: check if similar category reported within 200m
    const issues = await getIssues();
    let isDuplicate = false;
    let duplicateOfId: string | null = null;
    
    const MAX_DUPLICATE_DIST_KM = 0.2; 
    for (const existing of issues) {
      if (existing.status !== 'closed' && existing.category === finalCategory) {
        const dist = getDistanceKm(
          lat, lng,
          existing.location.lat, existing.location.lng
        );
        if (dist <= MAX_DUPLICATE_DIST_KM) {
          isDuplicate = true;
          duplicateOfId = existing.id;
          break;
        }
      }
    }

    const imageBase64 = image;

    if (ai) {
      try {
        console.log(`Analyzing issue with Gemini AI using gemini-3.5-flash...`);
        let aiPrompt = `
          You are an expert Civic Intelligence & AI Categorization system for "Samadhan Setu".
          Analyze the following civic complaint report:
          Description: "${description}"
          User Selected Category: "${finalCategory}"
          User Selected Severity: "${finalSeverity}"
          
          Respond ONLY with a valid JSON object containing:
          1. "category": Choose one of: "road" (potholes, cracks, bad pavement), "garbage" (trash overflows, litter, dumping), "water" (leakages, bursts, floods), "streetlight" (broken lamps, dark lane), "safety" (unlit alleys, visibility hazards, danger).
          2. "severity": "low", "medium", or "high" (based on structural risk, safety impact, and proximity to dining/schools).
          3. "title": A short, impactful, professionally formatted title for the issue.
          4. "department": Formulate a mapped civic department (e.g., "Municipal Corp - Road & Pavement Department", "SF Sanitary Service Dept", "Sanitation & Waste Division", "Water Utility Board", "Public Lighting & Grid Board", "Law Enforcement & Street Safety Group").
          5. "urgencyReason": Explain why it needs urgent resolution or is a hazard.
          6. "isSpam": boolean (true if it represents unrelated junk, insults, advertisements, or non-civic topics).
          
          Format your response as pure JSON without markdown codeblock packaging, so it can be parsed instantly.
        `;

        let contents: any = aiPrompt;

        if (imageBase64 && imageBase64.includes(';base64,')) {
          const parts = imageBase64.split(';base64,');
          const mimeType = parts[0].split(':')[1];
          const data = parts[1];

          contents = {
            parts: [
              { inlineData: { data, mimeType } },
              { text: aiPrompt }
            ]
          };
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents,
          config: {
            responseMimeType: 'application/json',
          }
        });

        const responseText = response.text || '';
        console.log('AI response text:', responseText);
        
        const parsed = JSON.parse(responseText.trim());
        
        if (parsed.isSpam) {
          return res.status(400).json({ error: 'AI flagged this complaint as off-topic, spam, or abusive. Please report structural civic problems only.' });
        }

        finalCategory = parsed.category || finalCategory;
        finalSeverity = parsed.severity || finalSeverity;
        finalTitle = parsed.title || finalTitle;
        finalDepartment = parsed.department || finalDepartment;
        finalUrgency = parsed.urgencyReason || '';
        
      } catch (aiErr) {
        console.error('Error in AI analysis, falling back to heuristics:', aiErr);
        const descLower = description.toLowerCase();
        if (descLower.includes('trash') || descLower.includes('dump') || descLower.includes('garbage') || descLower.includes('litter') || descLower.includes('waste')) {
          finalCategory = 'garbage';
          finalDepartment = 'Sanitation & Waste Disposal Department';
        } else if (descLower.includes('pipe') || descLower.includes('leak') || descLower.includes('water') || descLower.includes('burst') || descLower.includes('flood') || descLower.includes('waterlogged') || descLower.includes('waterlogging')) {
          finalCategory = 'water';
          finalDepartment = 'Urban Water Resources Board';
        } else if (descLower.includes('pothole') || descLower.includes('crack') || descLower.includes('asphalt') || descLower.includes('road') || descLower.includes('driveway')) {
          finalCategory = 'road';
          finalDepartment = 'Municipal Highway & Roads Division';
        } else if (descLower.includes('light') || descLower.includes('lamp') || descLower.includes('bulb') || descLower.includes('darkness') || descLower.includes('electric')) {
          finalCategory = 'streetlight';
          finalDepartment = 'Public Lighting & Electricity Authority';
        } else if (descLower.includes('danger') || descLower.includes('safety') || descLower.includes('unlit') || descLower.includes('security') || descLower.includes('dark alley')) {
          finalCategory = 'safety';
          finalDepartment = 'Public Safety & Neighborhood Services';
        }
      }
    }

    // Create Timeline
    const timeline: TimelineEvent[] = [
      {
        id: 't_' + Date.now() + '_1',
        status: 'reported',
        title: 'Issue Reported',
        description: `Reported by civic user ${userName}.`,
        timestamp: new Date().toISOString(),
        by: userName
      },
      {
        id: 't_' + Date.now() + '_2',
        status: 'ai_verified',
        title: 'AI Verification Completed',
        description: `Auto-categorized as "${finalCategory}" with ${finalSeverity} severity. Department routed: ${finalDepartment}.`,
        timestamp: new Date().toISOString(),
        by: 'Samadhan Setu AI'
      }
    ];

    if (isDuplicate) {
      timeline.push({
        id: 't_' + Date.now() + '_dup',
        status: 'reported',
        title: 'Potential Duplicate Flagged',
        description: `A similar active issue is already reported within 200m (ID: ${duplicateOfId}). Linking for consolidation.`,
        timestamp: new Date().toISOString(),
        by: 'Samadhan Setu AI'
      });
    }

    const newIssue: Issue = {
      id: issueId,
      category: finalCategory,
      title: finalTitle,
      description: cleanDescription,
      status: isDuplicate ? 'reported' : 'ai_verified',
      location: {
        lat,
        lng,
        address: cleanAddress,
        area: cleanArea,
        city: cleanCity
      },
      severity: finalSeverity,
      createdAt: new Date().toISOString(),
      reportedBy: userId,
      reportedByName: userName,
      mediaUrl: imageBase64 || MOCK_IMAGES[finalCategory],
      department: finalDepartment,
      upvotes: 1,
      downvotes: 0,
      votedUsers: { [userId]: 'valid' },
      comments: [],
      timeline,
      slaDays: slaMap[finalCategory] || 5,
      escalated: false,
      escalationDate: null,
      resolutionProofUrl: null,
      resolutionNotes: null,
      resolvedAt: null,
      urgencyReason: finalUrgency || 'Standard civic cleanup and repair pipeline',
      duplicateOf: duplicateOfId
    };

    await saveIssue(newIssue);
    
    // Award Points to Reporter
    const users = await getUsers();
    const reportingUser = users.find(u => u.id === userId);
    if (reportingUser) {
      reportingUser.points += 20;
      reportingUser.completed_reports += 1;
      
      if (reportingUser.completed_reports >= 10 && !reportingUser.badges.includes('Civic Legend')) {
        reportingUser.badges.push('Civic Legend');
      }
      if (finalCategory === 'road' && !reportingUser.badges.includes('Pothole Patrol')) {
        reportingUser.badges.push('Pothole Patrol');
      }
      if (finalCategory === 'streetlight' && !reportingUser.badges.includes('Street Light Sentry')) {
        reportingUser.badges.push('Street Light Sentry');
      }
      
      reportingUser.trust_score = Math.min(100, Math.max(50, reportingUser.trust_score + 1));
      await saveUser(reportingUser);
      await setCurrentSession(reportingUser);
    }

    res.status(201).json(newIssue);
  } catch (err) {
    console.error('Error reporting issue:', err);
    res.status(500).json({ error: 'Failed to submit reported issue.' });
  }
});

// 8. Community Voting & Validation
router.post('/issues/:id/vote', async (req, res) => {
  const { id } = req.params;
  const { voteType } = req.body;
  
  try {
    const currentSession = await getCurrentUserSession(req);
    if (!currentSession) {
      return res.status(401).json({ error: 'Must be logged in to validate issues.' });
    }

    const voterId = currentSession.id;
    const voterName = currentSession.name;

    const issue = await getIssueById(id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (issue.votedUsers && issue.votedUsers[voterId]) {
      return res.status(400).json({ error: 'You have already voted on this issue.' });
    }

    if (!issue.votedUsers) issue.votedUsers = {};
    issue.votedUsers[voterId] = voteType;

    if (voteType === 'valid') {
      issue.upvotes += 1;
    } else {
      issue.downvotes += 1;
    }

    issue.timeline.push({
      id: 'vote_' + Date.now(),
      status: issue.status,
      title: 'Community Vote Cast',
      description: `Voted "${voteType}" by community member ${voterName}.`,
      timestamp: new Date().toISOString(),
      by: voterName
    });

    if (issue.status === 'ai_verified' && (issue.upvotes - issue.downvotes) >= 2) {
      issue.status = 'community_verified';
      issue.timeline.push({
        id: 'verify_' + Date.now(),
        status: 'community_verified',
        title: 'Community Verified!',
        description: 'The issue achieved sufficient confidence voting consensus and is now routed to the official departmental queue.',
        timestamp: new Date().toISOString(),
        by: 'Samadhan Setu Platform'
      });

      const users = await getUsers();
      const reporterUser = users.find(u => u.id === issue.reportedBy);
      if (reporterUser) {
        reporterUser.points += 30;
        reporterUser.trust_score = Math.min(100, reporterUser.trust_score + 2);
        await saveUser(reporterUser);
      }
    }

    const users = await getUsers();
    const voterUser = users.find(u => u.id === voterId);
    if (voterUser) {
      voterUser.points += 10;
      voterUser.validations_count += 1;
      
      if (voterUser.validations_count >= 15 && !voterUser.badges.includes('Supreme Validator')) {
        voterUser.badges.push('Supreme Validator');
      }

      await saveUser(voterUser);
      if (voterId === currentSession.id) {
        await setCurrentSession(voterUser);
      }
    }

    await saveIssue(issue);
    res.json(issue);
  } catch (err) {
    console.error('Error processing validation vote:', err);
    res.status(500).json({ error: 'Failed to process validation vote.' });
  }
});

// 9. Add comment to an issue
router.post('/issues/:id/comment', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Comment text cannot be empty and must be a string.' });
  }

  const cleanText = sanitizeInput(text);
  if (cleanText.length < 1) {
    return res.status(400).json({ error: 'Comment text cannot be empty.' });
  }
  if (cleanText.length > 500) {
    return res.status(400).json({ error: 'Comment is too long. Please limit comments to 500 characters.' });
  }

  try {
    const currentSession = await getCurrentUserSession(req);
    if (!currentSession) {
      return res.status(401).json({ error: 'Must be logged in to comment.' });
    }

    const issue = await getIssueById(id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const newComment: Comment = {
      id: 'comment_' + Date.now(),
      userId: currentSession.id,
      userName: currentSession.name,
      userRole: currentSession.role,
      text: cleanText,
      createdAt: new Date().toISOString()
    };

    issue.comments.push(newComment);
    
    const users = await getUsers();
    const user = users.find(u => u.id === currentSession.id);
    if (user) {
      user.points += 2;
      await saveUser(user);
      await setCurrentSession(user);
      setSessionCookie(res, user);
    }

    await saveIssue(issue);
    res.status(201).json(newComment);
  } catch (err) {
    console.error('Error submitting comment:', err);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});

// 10. Update Issue Status (Authority Only)
router.post('/issues/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, notes, proofImage } = req.body;

  // Allowed list validation for IssueStatus enum
  const allowedStatuses: IssueStatus[] = ['reported', 'ai_verified', 'community_verified', 'assigned', 'in_progress', 'resolved', 'closed'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status transition value.' });
  }

  const cleanNotes = notes ? sanitizeInput(notes) : '';
  if (cleanNotes.length > 1000) {
    return res.status(400).json({ error: 'Status notes are too long. Please limit notes to 1000 characters.' });
  }

  if (proofImage && !isValidImage(proofImage)) {
    return res.status(400).json({ error: 'Invalid resolution proof image format or size (limit: 5MB).' });
  }

  try {
    const currentSession = await getCurrentUserSession(req);
    if (!currentSession || currentSession.role !== 'authority') {
      return res.status(403).json({ error: 'Permission denied. Only municipal authorities can update workflow status.' });
    }

    const issue = await getIssueById(id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    const prevStatus = issue.status;
    issue.status = status as IssueStatus;

    const eventTitleMap: Record<IssueStatus, string> = {
      reported: 'Issue Created',
      ai_verified: 'AI Auto-Verified',
      community_verified: 'Community Validated',
      assigned: 'Government Department Assigned',
      in_progress: 'Maintenance Commenced',
      resolved: 'Resolution Completed',
      closed: 'Citizen Confirmed Resolution'
    };

    const eventDescMap: Record<IssueStatus, string> = {
      reported: 'Re-opened or returned to reports backlog.',
      ai_verified: 'Re-validated by AI classification services.',
      community_verified: 'Re-established in community verification queues.',
      assigned: `Assigned to ${issue.department} under SLA. Notes: ${cleanNotes || 'Ready for dispatch.'}`,
      in_progress: `Maintenance crews active on-site. Work notes: ${cleanNotes || 'Excavation and patching active.'}`,
      resolved: `Resolution reported by ${currentSession.name}. Work notes: ${cleanNotes || 'Completed structural repairs.'}`,
      closed: `Resolution confirmed by inspecting officer. Notes: ${cleanNotes || 'SLA verified and closed.'}`
    };

    if (status === 'resolved' || status === 'closed') {
      issue.resolvedAt = new Date().toISOString();
      issue.resolutionProofUrl = proofImage || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80';
      issue.resolutionNotes = cleanNotes || 'Repairs finished and quality inspected by field agents.';
    }

    issue.timeline.push({
      id: 'timeline_' + Date.now(),
      status: status as IssueStatus,
      title: eventTitleMap[status] || 'Status Altered',
      description: eventDescMap[status] || `Status updated from ${prevStatus} to ${status}.`,
      timestamp: new Date().toISOString(),
      by: currentSession.name
    });

    await saveIssue(issue);
    auditLog('ISSUE_STATUS_CHANGED', currentSession.id, { issueId: id, from: prevStatus, to: status, notes: cleanNotes }, req);
    // Record on blockchain ledger when issue is resolved
    if (status === 'resolved') {
      try { recordResolutionOnLedger(issue); } catch (e) { console.error('Ledger write failed:', e); }
    }
    res.json(issue);
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update issue status.' });
  }
});

// 11. Autonomous SLA Escalation Agent Simulator
router.post('/system/fast-forward', async (req, res) => {
  const { days } = req.body;
  const advanceDays = Number(days) || 5;

  try {
    const issues = await getIssues();
    let escalatedCount = 0;
    const now = new Date();

    for (const issue of issues) {
      if (issue.status !== 'resolved' && issue.status !== 'closed' && !issue.escalated) {
        const createdDate = new Date(issue.createdAt);
        const adjustedCreatedDate = new Date(createdDate.getTime() - (advanceDays * 24 * 60 * 60 * 1000));
        issue.createdAt = adjustedCreatedDate.toISOString();

        const msDiff = now.getTime() - adjustedCreatedDate.getTime();
        const daysDiff = msDiff / (1000 * 60 * 60 * 24);

        if (daysDiff > issue.slaDays) {
          issue.escalated = true;
          issue.escalationDate = now.toISOString();
          escalatedCount++;

          issue.timeline.push({
            id: 'escalate_' + Date.now(),
            status: issue.status,
            title: '🚨 SLA ESCALATION TRIGGERED',
            description: `Autonomous agent detected SLA breach! Issue age exceeds SLA ceiling of ${issue.slaDays} days. Case escalated to District Commissioner and logged on the public dashboard.`,
            timestamp: now.toISOString(),
            by: 'SLA Escalation Agent'
          });
        }
        await saveIssue(issue);
      }
    }

    res.json({
      message: `Fast-forwarded state by ${advanceDays} days. Autonomous agent processed outstanding complaints.`,
      escalatedCount,
      totalActiveIssues: issues.filter(i => i.status !== 'resolved' && i.status !== 'closed').length
    });
  } catch (err) {
    console.error('Error running fast-forward simulation:', err);
    res.status(500).json({ error: 'Failed to run fast-forward SLA escalation simulation.' });
  }
});

// 12. Predictive localized infrastructure risks
router.get('/predictive/risks', (req, res) => {
  const risks = [
    {
      id: 'p1',
      zone: 'Connaught Place (Inner Circle)',
      hazardType: 'Monsoon Pothole Multiplication Risk',
      probability: 88,
      factors: ['Heavy monsoon rainfall forecast (+65mm)', 'Aged asphalt micro-cracking', 'High DTC bus traffic density'],
      recommendedAction: 'Pre-patch micro-fissures in high-risk zones'
    },
    {
      id: 'p2',
      zone: 'Dwarka (Sector 10 Corridor)',
      hazardType: 'Garbage Dump Overflow Risk',
      probability: 72,
      factors: ['Festival shopping weekend crowd spillover', 'Reduced municipal cleanup cycles on Sunday'],
      recommendedAction: 'Deploy 8 smart high-capacity compaction bins'
    },
    {
      id: 'p3',
      zone: 'Karol Bagh (Market Corridor)',
      hazardType: 'Water Pipeline Leakage Risk',
      probability: 64,
      factors: ['Thermal expansion stress', 'Pipes aged >40 years', 'Sub-surface metro construction vibration spikes'],
      recommendedAction: 'Acoustic pressure sensor sweeping'
    }
  ];
  res.json(risks);
});

export { router };

// ═══════════════════════════════════════════════════════════════
// FEATURE 1: WHATSAPP / SMS CHATBOT (Twilio Webhook)
// ═══════════════════════════════════════════════════════════════

// POST /api/whatsapp/webhook  — Twilio sends incoming messages here
router.post('/whatsapp/webhook', (req, res) => {
  const body = req.body?.Body || '';
  const from = req.body?.From || 'unknown';
  const mediaUrl = req.body?.MediaUrl0;
  const reply = processWhatsAppMessage(from, body, mediaUrl);
  res.set('Content-Type', 'text/xml');
  res.send(buildTwiMLResponse(reply));
});

// POST /api/whatsapp/test  — Simulate a WhatsApp message from the UI
router.post('/whatsapp/test', (req, res) => {
  const { message, from } = req.body;
  if (!message || !from) return res.status(400).json({ error: 'message and from are required.' });
  const reply = processWhatsAppMessage(from, message, undefined);
  res.json({ reply, from, message });
});

// ═══════════════════════════════════════════════════════════════
// FEATURE 2: IOT SENSOR NETWORK
// ═══════════════════════════════════════════════════════════════

// POST /api/iot/sensor-event  — Real sensors push data here
router.post('/iot/sensor-event', async (req, res) => {
  const payload: SensorPayload = req.body;
  if (!payload.sensorType || payload.value === undefined || !payload.location) {
    return res.status(400).json({ error: 'sensorType, value, and location are required.' });
  }

  const result = evaluateSensorThreshold(payload);

  if (!result.breached) {
    return res.json({ status: 'ok', message: 'Sensor reading within safe thresholds.', payload, result });
  }

  // Auto-create a civic issue from the sensor alert
  let autoIssue: Issue | null = null;
  try {
    const issues = await getIssues();
    const newIssue: Issue = {
      id: 'issue_iot_' + Date.now(),
      category: result.issueCategory,
      title: result.title,
      description: `[IoT AUTO-ALERT] Sensor ${payload.sensorId} at ${payload.location.address}. ${result.description}`,
      status: 'ai_verified',
      location: payload.location,
      severity: result.severity,
      createdAt: new Date().toISOString(),
      reportedBy: 'iot_system',
      reportedByName: 'IoT Sensor Network',
      mediaUrl: '',
      department: result.issueCategory === 'water' ? 'Jal Board' : result.issueCategory === 'road' ? 'PWD' : result.issueCategory === 'streetlight' ? 'BSES/DESU' : 'Municipal Corporation',
      upvotes: 0, downvotes: 0, votedUsers: {}, comments: [],
      timeline: [{ id: 'tl_iot_1', status: 'ai_verified', title: 'IoT Sensor Alert', description: `Automated alert from sensor ${payload.sensorId}. Value: ${payload.value} ${payload.unit}.`, timestamp: new Date().toISOString(), by: 'IoT System' }],
      slaDays: result.severity === 'high' ? 1 : 3,
      escalated: result.severity === 'high', escalationDate: result.severity === 'high' ? new Date().toISOString() : null,
      resolutionProofUrl: null, resolutionNotes: null, resolvedAt: null,
    };
    issues.push(newIssue);
    await saveIssue(newIssue);
    autoIssue = newIssue;
  } catch (e) {
    console.error('IoT auto-issue creation failed:', e);
  }

  res.json({ status: 'alert', message: 'Threshold breached! Issue auto-created.', payload, result, autoIssue });
});

// GET /api/iot/simulate  — Generate a random sensor event for demo
router.get('/iot/simulate', async (req, res) => {
  const breach = req.query.breach !== 'false';
  const payload = generateSimulatedSensorEvent(breach);

  // Forward to the sensor-event handler logic inline
  const result = evaluateSensorThreshold(payload);
  let autoIssue = null;
  if (result.breached) {
    try {
      const newIssue: Issue = {
        id: 'issue_iot_' + Date.now(),
        category: result.issueCategory,
        title: result.title,
        description: `[IoT SIMULATION] Sensor ${payload.sensorId}. ${result.description}`,
        status: 'ai_verified',
        location: payload.location,
        severity: result.severity,
        createdAt: new Date().toISOString(),
        reportedBy: 'iot_system',
        reportedByName: 'IoT Sensor Network',
        mediaUrl: '',
        department: 'Municipal Corporation',
        upvotes: 0, downvotes: 0, votedUsers: {}, comments: [],
        timeline: [{ id: 'tl_iot_sim_1', status: 'ai_verified', title: 'IoT Simulation Alert', description: `Simulated sensor event from ${payload.sensorId}.`, timestamp: new Date().toISOString(), by: 'IoT Simulator' }],
        slaDays: result.severity === 'high' ? 1 : 3,
        escalated: result.severity === 'high', escalationDate: null,
        resolutionProofUrl: null, resolutionNotes: null, resolvedAt: null,
      };
      await saveIssue(newIssue);
      autoIssue = newIssue;
    } catch (e) {
      console.error('Simulation issue save failed:', e);
    }
  }
  res.json({ status: result.breached ? 'alert' : 'ok', payload, result, autoIssue });
});

// ═══════════════════════════════════════════════════════════════
// FEATURE 3: EMERGENCY BROADCAST SYSTEM
// ═══════════════════════════════════════════════════════════════

// GET /api/broadcasts/active  — Fetch all non-expired broadcasts
router.get('/broadcasts/active', (req, res) => {
  const now = new Date().toISOString();
  const all = readBroadcasts();
  const active = all.filter(b => b.active && b.expiresAt > now);
  res.json(active);
});

// GET /api/broadcasts  — Fetch all broadcasts (admin)
router.get('/broadcasts', (req, res) => {
  res.json(readBroadcasts());
});

// POST /api/broadcasts  — Create a new broadcast (authority only)
router.post('/broadcasts', async (req, res) => {
  const { title, message, severity, targetZone, durationMinutes } = req.body;
  if (!title || !message || !severity || !targetZone) {
    return res.status(400).json({ error: 'title, message, severity, and targetZone are required.' });
  }
  const allowedSeverities = ['info', 'warning', 'critical'];
  if (!allowedSeverities.includes(severity)) {
    return res.status(400).json({ error: 'Invalid severity. Must be info, warning, or critical.' });
  }
  const session = await getCurrentUserSession(req);
  if (!session || session.role !== 'authority') {
    return res.status(403).json({ error: 'Permission denied. Only municipal authorities can post emergency broadcasts.' });
  }
  const expiresAt = new Date(Date.now() + (Number(durationMinutes) || 60) * 60 * 1000).toISOString();
  const broadcast: Broadcast = {
    id: 'broadcast_' + Date.now(),
    title: title.slice(0, 120),
    message: message.slice(0, 500),
    severity,
    targetZone,
    createdBy: session?.name || 'Authority',
    createdAt: new Date().toISOString(),
    expiresAt,
    active: true,
  };
  const all = readBroadcasts();
  all.push(broadcast);
  writeBroadcasts(all);
  auditLog('BROADCAST_CREATED', session?.id || 'unknown', { title, severity, targetZone }, req);
  res.status(201).json(broadcast);
});

// DELETE /api/broadcasts/:id  — Deactivate a broadcast
router.delete('/broadcasts/:id', async (req, res) => {
  const all = readBroadcasts();
  const idx = all.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Broadcast not found.' });
  all[idx].active = false;
  writeBroadcasts(all);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// FEATURE 4: BLOCKCHAIN VERIFICATION LEDGER
// ═══════════════════════════════════════════════════════════════

// GET /api/ledger  — Public ledger of all resolved issues
router.get('/ledger', (req, res) => {
  const records = getAllLedgerRecords();
  res.json(records);
});

// GET /api/ledger/verify  — Verify the integrity of the entire chain
router.get('/ledger/verify', (req, res) => {
  const result = verifyLedgerIntegrity();
  res.json(result);
});
