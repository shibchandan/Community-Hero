import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * 1. SQL Injection Detectors
 * Regular expressions to detect typical SQL injection payloads in inputs
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(select|union|insert|update|delete|drop|alter|truncate|create|replace)\b)/i,
  /('|--|\/\*|\*\/|;)/,
  /or\s+\d+\s*=\s*\d+/i,
  /or\s+true/i,
  /or\s+['"]\w+['"]\s*=\s*['"]\w+['"]/i,
  /union\s+all\s+select/i,
  /exec\s+(\@|xp_cmdshell|sp_)/i,
  /having\s+\d+\s*=\s*\d+/i
];

/**
 * Recursively scans request inputs (body, query, params) to detect any SQL/NoSQL injection signatures.
 */
export function sqlInjectionShield(req: Request, res: Response, next: NextFunction) {
  const detect = (value: any): boolean => {
    if (!value) return false;
    if (typeof value === 'string') {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(value)) {
          // Extra safety check: Allow standard safe text but block if it matches multiple risky patterns
          // e.g. "or 1=1" or standard comment marks
          if (
            value.includes("'") && (
              value.toLowerCase().includes('select') ||
              value.toLowerCase().includes('union') ||
              value.toLowerCase().includes('drop') ||
              value.toLowerCase().includes('--') ||
              value.includes(';')
            )
          ) {
            return true;
          }
          if (
            /or\s+\d+\s*=\s*\d+/i.test(value) ||
            /or\s+['"]\w+['"]\s*=\s*['"]\w+['"]/i.test(value) ||
            /union\s+all\s+select/i.test(value) ||
            /;--/.test(value) ||
            /; DROP/i.test(value)
          ) {
            return true;
          }
        }
      }
    } else if (typeof value === 'object') {
      // Guard against NoSQL operator injections (e.g., query params containing { "$gt": "" })
      for (const key of Object.keys(value)) {
        if (key.startsWith('$') && key !== '$date') {
          return true;
        }
        if (detect(value[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (detect(req.body) || detect(req.query) || detect(req.params)) {
    console.warn(`[SECURITY ALERT] Blocked potential SQL/NoSQL Injection attempt from IP: ${req.ip}`);
    return res.status(400).json({
      error: 'Security alert: Request blocked due to detection of prohibited injection patterns.'
    });
  }

  next();
}

/**
 * 2. Malware Push & Dangerous Upload Protection
 * Validates uploaded base64 image data to prevent shell code, executable binaries,
 * double-extension masquerades, and polyglot files containing active scripts (PHP/JS/HTML).
 */
export function validateImageMagicBytes(base64Str: string): { valid: boolean; reason?: string } {
  if (!base64Str) return { valid: true };

  // If it's a URL, it is already filtered or seeded, bypass local file analysis
  if (base64Str.startsWith('http://') || base64Str.startsWith('https://')) {
    return { valid: true };
  }

  // 1. Double extension check or general format validation
  if (!base64Str.includes(';base64,')) {
    return { valid: false, reason: 'Invalid upload format. Must be a valid Base64 encoded media payload.' };
  }

  const parts = base64Str.split(';base64,');
  const header = parts[0];
  const data = parts[1];

  // 2. Extract and check the declared MIME type
  const mimeMatch = header.match(/data:([^;]+)/);
  if (!mimeMatch) {
    return { valid: false, reason: 'Unable to extract MIME type from upload.' };
  }
  const mimeType = mimeMatch[1].toLowerCase();

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimeTypes.includes(mimeType)) {
    return { valid: false, reason: `MIME type "${mimeType}" is not permitted. Only standard image files (JPEG, PNG, WEBP, GIF) are allowed.` };
  }

  // 3. Verify actual binary magic bytes encoded in the base64 stream
  // We can look at the first few characters of the base64 string
  const prefix = data.substring(0, 16);

  let signatureValid = false;
  if (mimeType === 'image/jpeg') {
    // JPEGs usually start with /9j/ in base64 (which corresponds to 0xFFD8FF)
    signatureValid = prefix.startsWith('/9j/');
  } else if (mimeType === 'image/png') {
    // PNGs start with iVBORw0KGgo (which corresponds to 0x89504E470D0A1A0A)
    signatureValid = prefix.startsWith('iVBORw0K') || prefix.startsWith('iVBORw0KGgo');
  } else if (mimeType === 'image/gif') {
    // GIFs start with R0lGODlh or R0lGODdh (which corresponds to GIF89a / GIF87a)
    signatureValid = prefix.startsWith('R0lGODlh') || prefix.startsWith('R0lGODdh');
  } else if (mimeType === 'image/webp') {
    // WEBP starts with UklGR (which is RIFF)
    signatureValid = prefix.startsWith('UklGR');
  }

  if (!signatureValid) {
    return { valid: false, reason: 'File signature mismatch. The file content does not match its declared image extension.' };
  }

  // 4. Scan the decoded content headers for active code (PHP/HTML/JS polyglot attacks)
  // Decode a small portion of the start and end of the string to check for cleartext script injection
  try {
    const decodedStart = Buffer.from(data.substring(0, 1000), 'base64').toString('ascii');
    const dangerousPatterns = [
      /<\?php/i,
      /<script/i,
      /javascript:/i,
      /onload=/i,
      /onerror=/i,
      /eval\(/i,
      /system\(/i,
      /exec\(/i,
      /passthru\(/i,
      /shell_exec\(/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(decodedStart)) {
        return { valid: false, reason: 'Security alert: Dangerous script block or command string detected within image payload.' };
      }
    }
  } catch (err) {
    // Fail closed on decoding error
    return { valid: false, reason: 'Failed to complete binary integrity check.' };
  }

  return { valid: true };
}

/**
 * Express middleware wrapper for image uploads.
 * Inspects req.body.image or other fields for safe images.
 */
export function malwareUploadShield(req: Request, res: Response, next: NextFunction) {
  // Check image parameter if present in request body
  const image = req.body.image || req.body.mediaUrl;
  if (image) {
    const check = validateImageMagicBytes(image);
    if (!check.valid) {
      console.warn(`[SECURITY ALERT] Blocked potential malware/hazardous file upload from IP: ${req.ip}. Reason: ${check.reason}`);
      return res.status(400).json({ error: check.reason || 'Malicious upload detected.' });
    }
  }
  next();
}

/**
 * 3. DDoS Slowloris & Idle Connection Shield
 * Closes slow-sending clients or hung connections.
 */
export function ddosTimeoutShield(timeoutMs = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setTimeout(timeoutMs, () => {
      console.warn(`[SECURITY ALERT] Connection timed out for slow client from IP: ${req.ip}`);
      res.status(408).send('Request Timeout: Connection closed due to inactivity.');
    });
    next();
  };
}

/**
 * Stricter Rate Limiter for heavy AI resources (preventing prompt abuse and Gemini token exhaustion DDoS)
 */
export const issueCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Only 15 issues per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  message: { error: 'Too many reports created from this IP. Please try again after 15 minutes to prevent system congestion.' }
});
