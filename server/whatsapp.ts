/**
 * WhatsApp / SMS Chatbot Service (Twilio)
 * 5-step conversation state machine for reporting civic issues via WhatsApp.
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in your .env
 */
import crypto from 'crypto';

export type ChatState = 'IDLE' | 'AWAITING_DESCRIPTION' | 'AWAITING_LOCATION' | 'AWAITING_PHOTO' | 'CONFIRMED';

export interface ChatSession {
  state: ChatState;
  category?: string;
  description?: string;
  location?: string;
  photoUrl?: string;
  lastActivity: number;
}

// In-memory session store keyed by sender phone number
const sessions = new Map<string, ChatSession>();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSession(from: string): ChatSession {
  const existing = sessions.get(from);
  if (existing && Date.now() - existing.lastActivity < SESSION_TTL_MS) {
    existing.lastActivity = Date.now();
    return existing;
  }
  const fresh: ChatSession = { state: 'IDLE', lastActivity: Date.now() };
  sessions.set(from, fresh);
  return fresh;
}

function clearSession(from: string) {
  sessions.delete(from);
}

// Simple keyword-based category detector
function detectCategory(text: string): string {
  const t = text.toLowerCase();
  if (/road|pothole|crater|street|pavement/.test(t)) return 'road';
  if (/garbage|trash|waste|litter|dump/.test(t)) return 'garbage';
  if (/water|flood|pipe|leak|drain|sewage/.test(t)) return 'water';
  if (/light|lamp|dark|streetlight/.test(t)) return 'streetlight';
  if (/safety|crime|accident|fire|danger/.test(t)) return 'safety';
  return 'road';
}

/**
 * Main message processor. Returns the bot's reply string.
 */
export function processWhatsAppMessage(from: string, body: string, mediaUrl?: string): string {
  const text = body.trim();
  const lower = text.toLowerCase();
  const session = getSession(from);

  // Global cancel command
  if (lower === 'cancel' || lower === 'stop') {
    clearSession(from);
    return '❌ Report cancelled. Send "REPORT" anytime to start a new civic report.';
  }

  switch (session.state) {
    case 'IDLE': {
      if (lower.startsWith('report') || lower.startsWith('issue') || lower.startsWith('problem')) {
        session.state = 'AWAITING_DESCRIPTION';
        session.category = detectCategory(text);
        return (
          `👋 Welcome to *Samadhan Setu* Civic Reporting!\n\n` +
          `I detected this might be a *${session.category.toUpperCase()}* issue.\n\n` +
          `📝 Please describe the problem in detail.\n` +
          `_e.g. "Large pothole causing traffic jam and vehicle damage"_\n\n` +
          `_Send CANCEL anytime to stop._`
        );
      }
      return (
        `🏙️ *Samadhan Setu Civic Bot*\n\n` +
        `Send *REPORT* to report a civic issue.\n` +
        `Examples:\n` +
        `• REPORT pothole\n` +
        `• REPORT garbage not collected\n` +
        `• REPORT streetlight broken\n\n` +
        `_Powered by AI • Your reports matter!_`
      );
    }

    case 'AWAITING_DESCRIPTION': {
      if (text.length < 10) {
        return '⚠️ Please provide a more detailed description (at least 10 characters).';
      }
      session.description = text;
      session.state = 'AWAITING_LOCATION';
      return (
        `✅ Got it! Description recorded.\n\n` +
        `📍 Now send your *location*.\n` +
        `You can:\n` +
        `• Share your WhatsApp location 📎\n` +
        `• Or type the area name (e.g. "Sector 12, Noida")`
      );
    }

    case 'AWAITING_LOCATION': {
      session.location = text;
      session.state = 'AWAITING_PHOTO';
      return (
        `✅ Location saved: *${text}*\n\n` +
        `📸 Send a *photo* of the issue (optional).\n` +
        `Or send *SKIP* to submit without a photo.`
      );
    }

    case 'AWAITING_PHOTO': {
      if (lower === 'skip') {
        session.photoUrl = undefined;
      } else if (mediaUrl) {
        session.photoUrl = mediaUrl;
      } else {
        return `📸 Please send a photo, or type *SKIP* to continue without one.`;
      }
      const ref = crypto.randomBytes(4).toString('hex').toUpperCase();
      const finalSession = { ...session };
      clearSession(from);
      return (
        `🎉 *Report Submitted Successfully!*\n\n` +
        `📋 *Reference ID:* WA-${ref}\n` +
        `🏷️ *Category:* ${finalSession.category?.toUpperCase()}\n` +
        `📝 *Description:* ${finalSession.description}\n` +
        `📍 *Location:* ${finalSession.location}\n` +
        `📸 *Photo:* ${finalSession.photoUrl ? 'Attached ✓' : 'Not provided'}\n\n` +
        `⏱️ Our AI will verify your report within minutes.\n` +
        `You'll receive a status update here once assigned.\n\n` +
        `🏆 Thank you for making your city better! _+50 Hero Points_`
      );
    }

    default: {
      clearSession(from);
      return `Something went wrong. Send *REPORT* to start again.`;
    }
  }
}

/**
 * Build a TwiML XML response for Twilio
 */
export function buildTwiMLResponse(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${escaped}</Message>\n</Response>`;
}
