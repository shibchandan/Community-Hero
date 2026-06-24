import { Router } from 'express';
import { 
  getUsers,
  saveUser,
  getIssues,
  saveIssue,
  getIssueById,
  getCurrentSession,
  setCurrentSession,
  seedIfNeeded,
  getDistanceKm, 
  DEFAULT_USERS, 
  DEFAULT_ISSUES
} from './db';
import { ai } from './gemini';
import { Issue, User, Comment, TimelineEvent, IssueCategory, SeverityLevel, IssueStatus } from '../src/types';

const router = Router();

// Seed default database state in Firestore if empty
seedIfNeeded().then(() => {
  console.log('Database initialization with Firestore complete.');
}).catch((err) => {
  console.error('Database initialization with Firestore failed:', err);
});

// --- Security Validation & Sanitization Helpers ---

// Sanitize inputs to prevent Cross-Site Scripting (XSS)
function sanitizeInput(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
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
    const session = await getCurrentSession();
    res.json(session);
  } catch (err) {
    console.error('Error fetching current user session:', err);
    res.status(500).json({ error: 'Failed to retrieve active session.' });
  }
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
  const sanitizedRole = role === 'authority' ? 'authority' : 'citizen';

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
        // Create a brand new active citizen
        user = {
          id: sanitizedUid,
          name: sanitizedName || sanitizedEmail.split('@')[0],
          email: sanitizedEmail,
          role: sanitizedRole,
          points: 40, // 40 starting karma points
          trust_score: 100,
          badges: ['Civic Recruit'],
          completed_reports: 0,
          validations_count: 0,
          area: 'San Francisco'
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
    res.json({ message: 'Logged out backend session' });
  } catch (err) {
    console.error('Error in logout:', err);
    res.status(500).json({ error: 'Failed to clear session.' });
  }
});

// 3. Toggle active user role (Citizen <-> Authority Sandbox Simulator)
router.post('/users/toggle-role', async (req, res) => {
  try {
    const currentSession = await getCurrentSession();
    if (!currentSession) {
      return res.status(401).json({ error: 'You must be signed in to toggle roles.' });
    }

    const currentUserId = currentSession.id;
    const users = await getUsers();
    let userRecord = users.find(u => u.id === currentUserId);

    if (userRecord) {
      // Toggle the actual user record's role between citizen and authority
      userRecord.role = userRecord.role === 'citizen' ? 'authority' : 'citizen';
      await saveUser(userRecord);
      await setCurrentSession(userRecord);
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
router.post('/issues', async (req, res) => {
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
    const currentSession = await getCurrentSession();
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
          You are an expert Civic Intelligence & AI Categorization system for "Community Hero".
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
        } else if (descLower.includes('pothole') || descLower.includes('crack') || descLower.includes('asphalt') || descLower.includes('road') || descLower.includes('driveway')) {
          finalCategory = 'road';
          finalDepartment = 'Municipal Highway & Roads Division';
        } else if (descLower.includes('pipe') || descLower.includes('leak') || descLower.includes('water') || descLower.includes('burst') || descLower.includes('flood')) {
          finalCategory = 'water';
          finalDepartment = 'Urban Water Resources Board';
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
        by: 'Community Hero AI'
      }
    ];

    if (isDuplicate) {
      timeline.push({
        id: 't_' + Date.now() + '_dup',
        status: 'reported',
        title: 'Potential Duplicate Flagged',
        description: `A similar active issue is already reported within 200m (ID: ${duplicateOfId}). Linking for consolidation.`,
        timestamp: new Date().toISOString(),
        by: 'Community Hero AI'
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
        area: cleanArea
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
    const currentSession = await getCurrentSession();
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
        by: 'Community Hero Platform'
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
    const currentSession = await getCurrentSession();
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
    const currentSession = await getCurrentSession();
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
      zone: 'Mission District (East)',
      hazardType: 'Pothole Multiplication Risk',
      probability: 88,
      factors: ['Heavy rainfall forecast (+45mm)', 'Aged asphalt micro-cracking', 'High transit bus density'],
      recommendedAction: 'Pre-patch micro-fissures in high-risk zones'
    },
    {
      id: 'p2',
      zone: 'SOMA Tech Corridor',
      hazardType: 'Garbage Bin Overflow Risk',
      probability: 72,
      factors: ['Tech-conference weekend crowd spillover', 'Reduced sanitation pickup cycles on Sunday'],
      recommendedAction: 'Deploy 8 smart high-capacity compaction bins'
    },
    {
      id: 'p3',
      zone: 'Market District (West)',
      hazardType: 'Water Main Leakage Risk',
      probability: 64,
      factors: ['Thermal expansion stress', 'Pipes aged >45 years', 'Sub-surface vibration spikes'],
      recommendedAction: 'Acoustic pressure sensor sweeping'
    }
  ];
  res.json(risks);
});

export { router };
