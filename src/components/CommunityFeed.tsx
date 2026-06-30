/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Issue, Comment, TimelineEvent, IssueCategory, SeverityLevel } from '../types';
import { 
  CheckCircle2, AlertTriangle, MessageSquare, MapPin, 
  ThumbsUp, ThumbsDown, Clock, ShieldAlert, ChevronDown, 
  ChevronUp, Send, User, Calendar, Search, X, SlidersHorizontal,
  ArrowUpDown, Flame, Star, Share2, ArrowLeft, Heart, MessageCircle,
  Hash, Users, Image, Smile, Award, Check, AlertCircle, Plus, Sparkles
} from 'lucide-react';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface CommunityFeedProps {
  issues: Issue[];
  selectedIssueId?: string;
  onSelectIssue: (issue: Issue | undefined) => void;
  onVote: (issueId: string, voteType: 'valid' | 'invalid') => void;
  onAddComment: (issueId: string, commentText: string) => void;
  currentUserRole: 'citizen' | 'authority';
  currentUser?: any;
  theme?: 'dark' | 'light';
  activeSubTab?: 'all' | 'unresolved' | 'resolved' | 'escalated';
  onSubTabChange?: (tab: 'all' | 'unresolved' | 'resolved' | 'escalated') => void;
}

// ── Types for Community Board ────────────────────────────────────────────────
interface BoardPost {
  id: string;
  authorName: string;
  authorRole: 'citizen' | 'authority';
  title: string;
  content: string;
  tag: '#general' | '#volunteering' | '#announcement' | '#praise' | '#alert';
  imageUrl?: string;
  likes: number;
  likedByUser: boolean;
  reactions: Record<string, number>;
  comments: {
    id: string;
    authorName: string;
    authorRole: 'citizen' | 'authority';
    text: string;
    createdAt: string;
  }[];
  createdAt: string;
}

// ── Types for Stream Chat ────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: 'citizen' | 'authority';
  text: string;
  timestamp: string;
}

const PRE_SEEDED_POSTS: BoardPost[] = [
  {
    id: 'post-1',
    authorName: 'Kunal Sen',
    authorRole: 'citizen',
    title: 'Sanjay Lake Park Cleanup Drive: Sunday morning! 🌳',
    content: 'Hey everyone! Let\'s come together to clear plastic garbage along the walking track at Sanjay Lake Park. We\'ll start at 7:00 AM near the north entrance. Gloves and garbage bags will be provided by the local ward office. Let\'s make our lake clean and green again!',
    tag: '#volunteering',
    imageUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&q=80&w=1000',
    likes: 24,
    likedByUser: false,
    reactions: { '🎉': 12, '❤️': 8, '👏': 15 },
    comments: [
      {
        id: 'bc-1',
        authorName: 'Dr. Anita Sen',
        authorRole: 'citizen',
        text: 'I\'m definitely in! Bringing a couple of neighbors too.',
        createdAt: new Date(Date.now() - 3600000 * 20).toISOString()
      },
      {
        id: 'bc-2',
        authorName: 'Vikram Sharma',
        authorRole: 'authority',
        text: 'Excellent initiative. I have instructed the sanitation crew to pick up all collected waste bags by 11:00 AM on Sunday. Keep up the amazing work!',
        createdAt: new Date(Date.now() - 3600000 * 18).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'post-2',
    authorName: 'Riya Patil',
    authorRole: 'citizen',
    title: 'Sector 4 Water Leakage FIXED! 🎉💧',
    content: 'Amazing news! The major water pipe burst near the main intersection of Sector 4 that was wasting thousands of liters of clean water has been completely repaired! The municipal crew worked overnight. Big thanks to the community for supporting the report on our portal and voting it to the top. This shows the power of samadhan!',
    tag: '#praise',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=1000',
    likes: 38,
    likedByUser: false,
    reactions: { '👏': 22, '❤️': 14, '🎉': 19 },
    comments: [
      {
        id: 'bc-3',
        authorName: 'Subhash Mehta',
        authorRole: 'citizen',
        text: 'Yes! Walked past this morning, dry as a bone. Perfect fix.',
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
  },
  {
    id: 'post-3',
    authorName: 'Sanjay Kapoor',
    authorRole: 'authority',
    title: 'Scheduled Power Interruption for Transformer Upgrade ⚡',
    content: 'Please note that there will be a scheduled power outage tomorrow, June 30th, from 10:00 AM to 1:00 PM in Blocks B & C for critical transformer upgrades. This is to prevent regular voltage fluctuations in the area during peak summer. We appreciate your patience.',
    tag: '#announcement',
    likes: 12,
    likedByUser: false,
    reactions: { '👍': 8, '😮': 2 },
    comments: [],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];

const PRE_SEEDED_CHANNELS: Record<string, ChatMessage[]> = {
  '#general-discussions': [
    {
      id: 'msg-1',
      senderName: 'Meera Nair',
      senderRole: 'citizen',
      text: 'Hello everyone! Hope the sanitation trucks are on schedule today.',
      timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString()
    },
    {
      id: 'msg-2',
      senderName: 'Rajesh Gowda',
      senderRole: 'citizen',
      text: 'Yes, Meera! Just saw them in Block A about 15 minutes ago.',
      timestamp: new Date(Date.now() - 3600000 * 1.4).toISOString()
    },
    {
      id: 'msg-3',
      senderName: 'Arun Lal',
      senderRole: 'citizen',
      text: 'Great to hear. The garbage sorting drive seems to be working well too.',
      timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString()
    }
  ],
  '#emergency-coordination': [
    {
      id: 'msg-4',
      senderName: 'System Bot',
      senderRole: 'authority',
      text: '🚨 ALERT: High precipitation advisory issued. Heavy waterlogging potential at the Sector 11 underpass. Crews are being dispatched.',
      timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: 'msg-5',
      senderName: 'Vikram Sharma',
      senderRole: 'authority',
      text: 'Can confirm, the water pump crew has arrived at the Sector 11 bypass. Stay safe and avoid the underpass for the next 2 hours.',
      timestamp: new Date(Date.now() - 3600000 * 2.8).toISOString()
    }
  ],
  '#volunteer-initiatives': [
    {
      id: 'msg-6',
      senderName: 'Kunal Sen',
      senderRole: 'citizen',
      text: 'Who is free to help plant 10 new tree saplings near the Sector 4 community park this Saturday?',
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'msg-7',
      senderName: 'Dr. Anita Sen',
      senderRole: 'citizen',
      text: 'Count me in! I can bring 4 neem saplings and some organic fertilizer.',
      timestamp: new Date(Date.now() - 3600000 * 4.8).toISOString()
    },
    {
      id: 'msg-8',
      senderName: 'Rahul Verma',
      senderRole: 'citizen',
      text: 'I can help with the shovels and transport!',
      timestamp: new Date(Date.now() - 3600000 * 4.5).toISOString()
    }
  ]
};

const CHAT_USERS = [
  { name: 'Vikram Sharma', role: 'authority', status: 'online', avatarColor: 'bg-indigo-500' },
  { name: 'Dr. Anita Sen', role: 'citizen', status: 'online', avatarColor: 'bg-emerald-500' },
  { name: 'Rajesh Gowda', role: 'citizen', status: 'online', avatarColor: 'bg-blue-500' },
  { name: 'Meera Nair', role: 'citizen', status: 'online', avatarColor: 'bg-pink-500' },
  { name: 'Rahul Verma', role: 'citizen', status: 'away', avatarColor: 'bg-amber-500' },
  { name: 'Kunal Sen', role: 'citizen', status: 'offline', avatarColor: 'bg-slate-500' }
];

export default function CommunityFeed({ 
  issues, 
  selectedIssueId, 
  onSelectIssue, 
  onVote, 
  onAddComment,
  currentUserRole,
  currentUser,
  theme = 'dark',
  activeSubTab,
  onSubTabChange
}: CommunityFeedProps) {
  // ── High-Level Hub Navigation ──────────────────────────────────────────────
  const [hubTab, setHubTab] = useState<'incidents' | 'board' | 'chat'>('incidents');

  // ── Incidents Feed States (Original) ────────────────────────────────────────
  const [localActiveTab, setLocalActiveTab] = useState<'all' | 'unresolved' | 'resolved' | 'escalated'>('unresolved');
  const activeTab = activeSubTab !== undefined ? activeSubTab : localActiveTab;
  const setActiveTab = onSubTabChange !== undefined ? onSubTabChange : setLocalActiveTab;
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'upvotes' | 'sla_urgency'>('newest');

  // ── Community Board States ──────────────────────────────────────────────────
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>(() => {
    try {
      const stored = localStorage.getItem('civic_board_posts');
      const posts = stored ? JSON.parse(stored) : PRE_SEEDED_POSTS;
      // Sanitize/upgrade any bad/broken image URLs in old localStorage
      return posts.map((post: any) => {
        if (post.id === 'post-2' || (post.imageUrl && (post.imageUrl.includes('photo-1517646287270-a5a9ca602e5c') || post.imageUrl.includes('photo-1500340520802-168326a2f3d1') || post.imageUrl.includes('photo-1542013936693-8848e574047a') || post.imageUrl.includes('photo-1541888946425-d81bb19240f5')))) {
          return {
            ...post,
            imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=1000'
          };
        }
        return post;
      });
    } catch {
      return PRE_SEEDED_POSTS;
    }
  });
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postTag, setPostTag] = useState<BoardPost['tag']>('#general');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postCommentTexts, setPostCommentTexts] = useState<Record<string, string>>({});
  const [expandedBoardComments, setExpandedBoardComments] = useState<Record<string, boolean>>({});
  const [boardSearchQuery, setBoardSearchQuery] = useState('');
  const [boardTagFilter, setBoardTagFilter] = useState<string>('all');

  // Save board posts to localStorage
  useEffect(() => {
    localStorage.setItem('civic_board_posts', JSON.stringify(boardPosts));
  }, [boardPosts]);

  // ── Chat States ─────────────────────────────────────────────────────────────
  const [activeChannel, setActiveChannel] = useState<string>('#general-discussions');
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const stored = localStorage.getItem('civic_chat_messages');
      return stored ? JSON.parse(stored) : PRE_SEEDED_CHANNELS;
    } catch {
      return PRE_SEEDED_CHANNELS;
    }
  });
  const [typedMessage, setTypedMessage] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Room Creation & Joining States ──────────────────────────────────────────
  const [roomDescriptions, setRoomDescriptions] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('civic_room_descriptions');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      '#general-discussions': 'Local news & weather',
      '#emergency-coordination': 'Precautions & response',
      '#volunteer-initiatives': 'Cleanup & plantations'
    };
  });

  // Save room descriptions to localStorage
  useEffect(() => {
    localStorage.setItem('civic_room_descriptions', JSON.stringify(roomDescriptions));
  }, [roomDescriptions]);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');

  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joiningRoomSearch, setJoiningRoomSearch] = useState('');

  const ALL_DISCOVERABLE_ROOMS = useMemo(() => [
    { name: '#clean-energy-forum', description: 'Solar & wind power local talks' },
    { name: '#local-traffic-updates', description: 'Road blocks and bypass info' },
    { name: '#waste-management-alerts', description: 'Garbage truck schedules & bin reporting' },
    { name: '#stray-animal-care', description: 'Stray adoption & vet drives' },
    { name: '#citizen-education-debate', description: 'Local schools & library facilities' }
  ], []);

  // Filter list of available public rooms the user hasn't joined yet
  const joinablePublicRooms = useMemo(() => {
    const joinedSet = new Set(Object.keys(chatMessages));
    return ALL_DISCOVERABLE_ROOMS.filter(r => !joinedSet.has(r.name));
  }, [chatMessages, ALL_DISCOVERABLE_ROOMS]);

  // Memoized list of room citizens (including logged-in user and Samadhan AI bot)
  const activeChannelCitizens = useMemo(() => {
    const list = [...CHAT_USERS];
    const uName = currentUser?.name || 'shíbu';
    const uRole = currentUser?.role || 'citizen';

    // Verify if there is already a user with this name
    const exists = list.some(u => u.name.toLowerCase() === uName.toLowerCase());

    if (!exists) {
      list.push({
        name: uName,
        role: uRole,
        status: 'online',
        avatarColor: 'bg-violet-600'
      });
    } else {
      // Set status to online for matching name
      for (const u of list) {
        if (u.name.toLowerCase() === uName.toLowerCase()) {
          u.status = 'online';
        }
      }
    }

    // Unshift the Samadhan AI Bot to the top of the room's citizen list
    list.unshift({
      name: 'Samadhan AI',
      role: 'assistant' as any,
      status: 'online',
      avatarColor: 'bg-indigo-600'
    });

    return list;
  }, [currentUser]);

  // Save chat to localStorage
  useEffect(() => {
    localStorage.setItem('civic_chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Scroll to bottom when channel or messages change
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeChannel, typingUser]);

  // ── Multi-dimensional filter + sort logic for Incidents (Original) ──────────
  const filteredIssues = useMemo(() => {
    let result = issues.filter(issue => {
      // Status tab filter
      if (activeTab === 'unresolved' && (issue.status === 'resolved' || issue.status === 'closed')) return false;
      if (activeTab === 'resolved' && issue.status !== 'resolved' && issue.status !== 'closed') return false;
      if (activeTab === 'escalated' && !issue.escalated) return false;

      // Category filter
      if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;

      // Severity filter
      if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;

      // Text search (title + description + location)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack = `${issue.title} ${issue.description} ${issue.location.address} ${issue.location.area} ${issue.department}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    // Sort
    if (sortBy === 'newest') {
      result = result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'upvotes') {
      result = result.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    } else if (sortBy === 'sla_urgency') {
      result = result.sort((a, b) => {
        const urgencyA = (Date.now() - new Date(a.createdAt).getTime()) / (a.slaDays * 86400000);
        const urgencyB = (Date.now() - new Date(b.createdAt).getTime()) / (b.slaDays * 86400000);
        return urgencyB - urgencyA;
      });
    }

    return result;
  }, [issues, activeTab, categoryFilter, severityFilter, searchQuery, sortBy]);

  const getCategoryBadge = (cat: IssueCategory) => {
    const map: Record<IssueCategory, { label: string, colorDark: string, colorLight: string }> = {
      road: { label: '🚧 Road Damage', colorDark: 'bg-amber-500/10 text-amber-400 border-amber-500/20', colorLight: 'bg-amber-500/20 text-amber-950 border-amber-500/40 font-bold' },
      garbage: { label: '🚮 Waste Overflow', colorDark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', colorLight: 'bg-emerald-500/20 text-emerald-950 border-emerald-500/40 font-bold' },
      water: { label: '💧 Water Leak', colorDark: 'bg-sky-500/10 text-sky-400 border-sky-500/20', colorLight: 'bg-sky-500/20 text-sky-950 border-sky-500/40 font-bold' },
      streetlight: { label: '💡 Streetlight', colorDark: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', colorLight: 'bg-yellow-500/20 text-yellow-900 border-yellow-500/40 font-bold' },
      safety: { label: '🚨 Public Safety', colorDark: 'bg-rose-500/10 text-rose-400 border-rose-500/20', colorLight: 'bg-rose-500/20 text-rose-950 border-rose-500/40 font-bold' }
    };
    const details = map[cat] || { label: cat, colorDark: 'bg-slate-500/10 text-slate-400 border-slate-500/20', colorLight: 'bg-slate-200/80 text-slate-900 border-slate-300 font-bold' };
    return (
      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${theme === 'dark' ? details.colorDark : details.colorLight}`}>
        {details.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string, colorDark: string, colorLight: string }> = {
      reported: { label: 'Backlog Reported', colorDark: 'bg-slate-500/10 text-slate-400 border-slate-500/20', colorLight: 'bg-slate-200/80 text-slate-800 border-slate-300 font-bold' },
      ai_verified: { label: 'AI Scanning OK', colorDark: 'bg-violet-500/10 text-violet-400 border-violet-500/20', colorLight: 'bg-violet-200/80 text-violet-950 border-violet-300 font-bold' },
      community_verified: { label: 'Civic Verified', colorDark: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse', colorLight: 'bg-blue-200/80 text-blue-950 border-blue-300 font-bold animate-pulse' },
      assigned: { label: 'Assigned Crew', colorDark: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', colorLight: 'bg-indigo-200/80 text-indigo-950 border-indigo-300 font-bold' },
      in_progress: { label: 'In Progress', colorDark: 'bg-purple-500/10 text-purple-400 border-purple-500/20', colorLight: 'bg-purple-200/80 text-purple-950 border-purple-300 font-bold' },
      resolved: { label: 'Repaired Fixed', colorDark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', colorLight: 'bg-emerald-200/80 text-emerald-950 border-emerald-300 font-bold' },
      closed: { label: 'Archived Closed', colorDark: 'bg-slate-400/10 text-slate-400 border-slate-400/20', colorLight: 'bg-slate-200 text-slate-700 border-slate-300 font-bold' }
    };
    const details = map[status] || { label: status, colorDark: 'bg-slate-500/10 text-slate-400 border-slate-500/20', colorLight: 'bg-slate-200 text-slate-800 border-slate-300 font-bold' };
    return (
      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${theme === 'dark' ? details.colorDark : details.colorLight}`}>
        {details.label}
      </span>
    );
  };

  const handleCommentSubmit = (issueId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) {
      setCommentError('Comment text cannot be empty.');
      return;
    }
    onAddComment(issueId, commentText);
    setCommentText('');
    setCommentError(null);
  };

  const getDaysAgo = (dateStr: string) => {
    const created = new Date(dateStr);
    const diff = Date.now() - created.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  // ── Community Board Handlers ────────────────────────────────────────────────
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return;

    const newPost: BoardPost = {
      id: `post-${Date.now()}`,
      authorName: currentUserRole === 'authority' ? 'Vikram Sharma' : 'You (Citizen)',
      authorRole: currentUserRole,
      title: postTitle,
      content: postContent,
      tag: postTag,
      imageUrl: postImageUrl.trim() ? postImageUrl : undefined,
      likes: 0,
      likedByUser: false,
      reactions: {},
      comments: [],
      createdAt: new Date().toISOString()
    };

    setBoardPosts([newPost, ...boardPosts]);
    setPostTitle('');
    setPostContent('');
    setPostImageUrl('');
    setIsCreatingPost(false);
  };

  const handleLikePost = (postId: string) => {
    setBoardPosts(boardPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          likes: p.likedByUser ? p.likes - 1 : p.likes + 1,
          likedByUser: !p.likedByUser
        };
      }
      return p;
    }));
  };

  const handleAddReaction = (postId: string, emoji: string) => {
    setBoardPosts(boardPosts.map(p => {
      if (p.id === postId) {
        const reactions = { ...p.reactions };
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        return { ...p, reactions };
      }
      return p;
    }));
  };

  const handleAddBoardComment = (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const txt = postCommentTexts[postId];
    if (!txt || !txt.trim()) return;

    setBoardPosts(boardPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          comments: [
            ...p.comments,
            {
              id: `bc-${Date.now()}`,
              authorName: currentUserRole === 'authority' ? 'Vikram Sharma' : 'You (Citizen)',
              authorRole: currentUserRole,
              text: txt,
              createdAt: new Date().toISOString()
            }
          ]
        };
      }
      return p;
    }));

    setPostCommentTexts({
      ...postCommentTexts,
      [postId]: ''
    });
  };

  const filteredBoardPosts = useMemo(() => {
    return boardPosts.filter(post => {
      const tagMatches = boardTagFilter === 'all' || post.tag === boardTagFilter;
      if (!tagMatches) return false;

      if (boardSearchQuery.trim()) {
        const q = boardSearchQuery.toLowerCase();
        return post.title.toLowerCase().includes(q) || post.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [boardPosts, boardTagFilter, boardSearchQuery]);

  // ── Room Creation & Joining Handlers ─────────────────────────────────────────
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    let cleanName = newRoomName.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
    if (!cleanName.startsWith('#')) {
      cleanName = '#' + cleanName;
    }
    
    if (chatMessages[cleanName]) {
      alert("A room with this name already exists!");
      return;
    }

    const initialWelcomeMessage: ChatMessage = {
      id: `msg-welcome-${Date.now()}`,
      senderName: 'Samadhan AI',
      senderRole: 'assistant' as any,
      text: `Welcome to the new #${cleanName.replace('#', '')} civic room! This room was created by ${currentUser?.name || 'a citizen'} to discuss: ${newRoomDesc || 'no description provided'}.`,
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => ({
      ...prev,
      [cleanName]: [initialWelcomeMessage]
    }));

    setRoomDescriptions(prev => ({
      ...prev,
      [cleanName]: newRoomDesc.trim() || 'Custom citizen room'
    }));

    setActiveChannel(cleanName);
    setIsCreatingRoom(false);
    setNewRoomName('');
    setNewRoomDesc('');
  };

  const handleJoinRoom = (roomName: string, desc: string) => {
    if (chatMessages[roomName]) {
      setActiveChannel(roomName);
      setIsJoiningRoom(false);
      return;
    }

    const initialWelcomeMessage: ChatMessage = {
      id: `msg-welcome-${Date.now()}`,
      senderName: 'Samadhan AI',
      senderRole: 'assistant' as any,
      text: `Welcome to #${roomName.replace('#', '')}! You have successfully joined the room.`,
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => ({
      ...prev,
      [roomName]: [initialWelcomeMessage]
    }));

    setRoomDescriptions(prev => ({
      ...prev,
      [roomName]: desc
    }));

    setActiveChannel(roomName);
    setIsJoiningRoom(false);
  };

  // ── Chat Handlers ───────────────────────────────────────────────────────────
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || typingUser !== null) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: currentUser?.name || (currentUserRole === 'authority' ? 'Vikram Sharma' : 'You (Citizen)'),
      senderRole: currentUserRole,
      text: typedMessage,
      timestamp: new Date().toISOString()
    };

    const currentChannelMsgs = chatMessages[activeChannel] || [];
    const updatedMessages = {
      ...chatMessages,
      [activeChannel]: [...currentChannelMsgs, userMsg]
    };

    setChatMessages(updatedMessages);
    const sentText = typedMessage;
    setTypedMessage('');

    // Trigger standard citizen chat simulation
    const triggerStandardCitizenSimulation = (inputText: string) => {
      // Pick a random online participant from CHAT_USERS (not Vikram Sharma or the current user)
      const responseCandidates = CHAT_USERS.filter(u => u.status === 'online' && u.name !== 'Vikram Sharma' && u.name.toLowerCase() !== (currentUser?.name || '').toLowerCase());
      const randomParticipant = responseCandidates[Math.floor(Math.random() * responseCandidates.length)] || CHAT_USERS[1];
      
      setTypingUser(randomParticipant.name);

      setTimeout(() => {
        const defaultCivicReplies = [
          "That sounds like a great idea. Let's make sure we log this properly on the radar.",
          "I agree! Improving our local ward coordination should be our top priority.",
          "Is there any way I can help support this effort? Let me know if you need assistance.",
          "Good point. I've noticed this issue as well during my morning walks.",
          "Let's post this on the community notice board too so other residents can see.",
          "Thank you for sharing this update. It's really helpful to know what's happening.",
          "We should raise this with the local Resident Welfare Association (RWA) next weekend.",
          "Glad to see everyone actively coordinating on these neighborhood matters here!",
          "Yes! This area really needs some active volunteer attention.",
          "I will look out for municipal work crews today and update here if I spot any."
        ];
        
        let replyText = defaultCivicReplies[Math.floor(Math.random() * defaultCivicReplies.length)];
        const lowerMsg = inputText.toLowerCase();

        if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
          replyText = `Hello! Glad to see you active in ${activeChannel}. How is everything in your sector today?`;
        } else if (lowerMsg.includes('cleanup') || lowerMsg.includes('clean') || lowerMsg.includes('volunteer')) {
          replyText = 'Oh I would absolutely love to join! Let\'s coordinate a date. Sunday morning is perfect for me.';
        } else if (lowerMsg.includes('pothole') || lowerMsg.includes('road') || lowerMsg.includes(' streetlight')) {
          replyText = 'Definitely log a report on the "Explore Radar" tab too. That gets tracked on the SLA clock instantly!';
        } else if (lowerMsg.includes('water') || lowerMsg.includes('leak')) {
          replyText = 'Water conservation is key. I\'ll check if the local technician is already dispatched near that road.';
        } else if (lowerMsg.includes('rain') || lowerMsg.includes('flood') || lowerMsg.includes('storm')) {
          replyText = 'Stay safe everyone! Make sure you keep your phone charged and avoid low waterlogged roads.';
        }

        const systemMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          senderName: randomParticipant.name,
          senderRole: randomParticipant.role as 'citizen' | 'authority',
          text: replyText,
          timestamp: new Date().toISOString()
        };

        setChatMessages(prev => ({
          ...prev,
          [activeChannel]: [...(prev[activeChannel] || []), systemMsg]
        }));
        setTypingUser(null);
      }, 1500);
    };

    // Trigger AI Chatbot Evaluation after a brief delay
    setTimeout(() => {
      setTypingUser('Samadhan AI');

      fetch('/api/chat/gemini-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [...currentChannelMsgs, userMsg],
          channel: activeChannel
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.shouldReply && data.text) {
          // AI Bot decided to reply!
          setTimeout(() => {
            const botMsg: ChatMessage = {
              id: `msg-bot-${Date.now()}`,
              senderName: 'Samadhan AI',
              senderRole: 'assistant' as any,
              text: data.text,
              timestamp: new Date().toISOString()
            };

            setChatMessages(prev => ({
              ...prev,
              [activeChannel]: [...(prev[activeChannel] || []), botMsg]
            }));
            setTypingUser(null);
          }, 800);
        } else {
          // AI Bot decided to stay silent; let a citizen chime in instead!
          setTypingUser(null);
          triggerStandardCitizenSimulation(sentText);
        }
      })
      .catch(err => {
        console.error('Error contacting Gemini chatbot API:', err);
        setTypingUser(null);
        triggerStandardCitizenSimulation(sentText);
      });
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Civic Hub Tab Selector ── */}
      <div id="civic-hub-header" className={`flex p-1.5 rounded-2xl backdrop-blur-md border ${
        theme === 'dark' 
          ? 'bg-slate-900/60 border-white/10' 
          : 'bg-white/80 border-slate-200 shadow-md'
      }`}>
        <button
          id="tab-btn-incidents"
          onClick={() => setHubTab('incidents')}
          className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            hubTab === 'incidents'
              ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white shadow-md'
              : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <SlidersHorizontal className="w-4.5 h-4.5" />
          Incidents Tracker
        </button>
        <button
          id="tab-btn-board"
          onClick={() => setHubTab('board')}
          className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            hubTab === 'board'
              ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white shadow-md'
              : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4.5 h-4.5" />
          Community Board
        </button>
        <button
          id="tab-btn-chat"
          onClick={() => setHubTab('chat')}
          className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            hubTab === 'chat'
              ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white shadow-md'
              : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4.5 h-4.5" />
          Live Citizen Chat
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 1: INCIDENTS TRACKER (Original CommunityFeed Implementation)
          ──────────────────────────────────────────────────────────────────────── */}
      {hubTab === 'incidents' && (
        <motion.div
          key="incidents-hub"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex flex-col gap-4"
        >
          {/* ── Status Tabs ───────────────────────────────────────────────────── */}
          <div className={`flex p-1 rounded-xl backdrop-blur-md ${
            theme === 'dark' 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-white/45 border border-white/80 shadow-xs'
          }`}>
            {(['unresolved', 'resolved', 'escalated', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-white/5'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-white/50'
                }`}
              >
                {tab === 'unresolved' ? 'Active Issues' : tab === 'resolved' ? 'Resolved Works' : tab === 'escalated' ? '🚨 SLA Breaches' : 'Backlog All'}
              </button>
            ))}
          </div>

          {/* ── Search Bar ───────────────────────────────────────────────────── */}
          <div className="relative">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search issues by title, location, department..."
              className={`w-full text-xs pl-10 pr-10 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 text-slate-100 placeholder-slate-600 focus:bg-white/8 focus:border-indigo-500/40'
                  : 'bg-white/70 border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-400'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all cursor-pointer ${
                  theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ── Category Filter Chips ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: 'all', label: '🗂 All Categories' },
              { id: 'road', label: '🚧 Road' },
              { id: 'garbage', label: '🚮 Garbage' },
              { id: 'water', label: '💧 Water' },
              { id: 'streetlight', label: '💡 Streetlight' },
              { id: 'safety', label: '🚨 Safety' },
            ] as { id: IssueCategory | 'all'; label: string }[]).map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-indigo-600 text-white border-indigo-500/50 shadow-sm shadow-indigo-500/20'
                    : theme === 'dark'
                      ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* ── Severity + Sort Row ──────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity */}
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Severity:</span>
            </div>
            {(['all', 'high', 'medium', 'low'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer capitalize ${
                  severityFilter === sev
                    ? sev === 'high' ? 'bg-rose-500 text-white border-rose-500/50'
                      : sev === 'medium' ? 'bg-amber-500 text-white border-amber-500/50'
                      : sev === 'low' ? 'bg-emerald-500 text-white border-emerald-500/50'
                      : 'bg-indigo-600 text-white border-indigo-500/50'
                    : theme === 'dark'
                      ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}
              >
                {sev === 'all' ? 'All' : sev}
              </button>
            ))}

            {/* Sort ─ pushed to right */}
            <div className="sm:ml-auto flex items-center gap-1.5">
              <ArrowUpDown className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className={`text-[10px] font-bold py-1 px-2 rounded-lg border focus:outline-none cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-white/10 text-slate-300'
                    : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                }`}
              >
                <option value="newest">🗓 Newest Reports</option>
                <option value="upvotes">🔥 Community Priority</option>
                <option value="sla_urgency">🚨 SLA Urgency Clock</option>
              </select>
            </div>
          </div>

          {/* ── Issues Stream List ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {filteredIssues.length === 0 ? (
              <div className={`p-8 text-center rounded-2xl border col-span-full ${
                theme === 'dark' ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-100'
              }`}>
                <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>No issues found Matching filters</p>
                <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Try adjusting filters or submit a new hazard on the explore map page.</p>
              </div>
            ) : (
              filteredIssues.map(issue => {
                const isSelected = selectedIssueId === issue.id;
                const totalVotes = issue.upvotes + issue.downvotes;
                const confidenceScore = issue.upvotes - issue.downvotes;
                
                return (
                  <div 
                    key={issue.id}
                    id={`issue-card-${issue.id}`}
                    onClick={() => onSelectIssue(isSelected ? undefined : issue)}
                    className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full ${
                      isSelected 
                        ? 'ring-2 ring-indigo-500/80 shadow-xl' 
                        : 'hover:translate-y-[-1px]'
                    } ${
                      theme === 'dark'
                        ? isSelected ? 'bg-slate-900/90 border-indigo-500' : 'bg-white/4 border-white/5 hover:bg-white/6 hover:border-white/10'
                        : isSelected ? 'bg-white border-indigo-500 shadow-md' : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getCategoryBadge(issue.category)}
                        {getStatusBadge(issue.status)}
                        {issue.escalated && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500 text-white animate-pulse">
                            🚨 SLA Breached
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {getDaysAgo(issue.createdAt)}
                      </span>
                    </div>

                    {/* Content Section */}
                    <div className="flex flex-col flex-1">
                      {/* Image Thumbnail */}
                      <div className="h-44 w-full overflow-hidden rounded-xl border border-slate-100 dark:border-white/5 bg-slate-900 mb-3.5 shrink-0 relative">
                        <img 
                          src={issue.mediaUrl} 
                          alt={issue.title} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className={`text-sm font-bold leading-snug line-clamp-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900 font-extrabold'}`}>
                            {issue.title}
                          </h3>
                          <p className={`text-xs line-clamp-3 mt-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                            {issue.description}
                          </p>
                        </div>

                        {/* Metadata Footer */}
                        <div className="flex flex-col gap-2 mt-4 pt-3.5 border-t border-slate-100 dark:border-white/5 text-[10px]">
                          <span className={`flex items-center gap-1.5 font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>
                            <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate">{issue.location.address}, {issue.location.area}</span>
                          </span>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`flex items-center gap-1 font-mono font-bold ${
                              issue.severity === 'high' ? 'text-rose-500' : issue.severity === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                            }`}>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {issue.severity.toUpperCase()} Priority
                            </span>
                            <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500 font-semibold'}`}>
                              <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="truncate">By {issue.reportedByName}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detailed Panel */}
                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-4" onClick={e => e.stopPropagation()}>
                        
                        {/* SLA Info Card */}
                        <div className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                          theme === 'dark' ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-100'
                        }`}>
                          <div className="space-y-1">
                            <span className={`text-[10px] font-extrabold uppercase tracking-widest text-indigo-500 dark:text-indigo-400`}>SLA Department Routing</span>
                            <p className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900 font-extrabold'}`}>
                              Assigned: {issue.department}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${issue.escalated ? 'text-rose-500 animate-spin' : 'text-indigo-500'}`} />
                            <div className="text-left md:text-right">
                              <span className={`text-[10px] block ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600 font-semibold'}`}>Resolution SLA Days</span>
                              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900 font-extrabold'}`}>{issue.slaDays} Days Goal</span>
                            </div>
                          </div>
                        </div>

                        {/* Resolution Proof Slider (if available) */}
                        {issue.status === 'resolved' && issue.resolutionProofUrl && (
                          <div className="space-y-2">
                            <h4 className={`text-xs font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-800'}`}>
                              <CheckCircle2 className="w-4 h-4" /> Before / After Resolution Inspection
                            </h4>
                            <div className="rounded-xl overflow-hidden border border-emerald-500/25 max-w-lg mx-auto">
                              <BeforeAfterSlider 
                                beforeUrl={issue.mediaUrl}
                                afterUrl={issue.resolutionProofUrl}
                              />
                            </div>
                            {issue.resolutionNotes && (
                              <p className={`text-xs p-3 rounded-xl italic border ${
                                theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/10 text-slate-300' : 'bg-emerald-50 border-emerald-200 text-emerald-950 font-medium'
                              }`}>
                                <strong className="not-italic block text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-1">Crew Resolution Logs:</strong>
                                "{issue.resolutionNotes}"
                              </p>
                            )}
                          </div>
                        )}

                        {/* Action Log / Timeline */}
                        <div className="space-y-2">
                          <h4 className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                            theme === 'dark' ? 'text-slate-500' : 'text-slate-750 font-extrabold'
                          }`}>
                            <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" /> Administrative Audit Trail ({issue.timeline?.length || 0})
                          </h4>
                          <div className={`p-3 rounded-xl space-y-3.5 border ${
                            theme === 'dark' ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-150'
                          }`}>
                            {issue.timeline?.map((evt) => (
                              <div key={evt.id} className="flex gap-3 text-xs">
                                <div className="flex flex-col items-center">
                                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                  <div className="w-0.5 flex-1 bg-slate-200 dark:bg-white/10 mt-1" />
                                </div>
                                <div>
                                  <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-extrabold'}`}>{evt.title}</p>
                                  <p className={`text-[11px] mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>{evt.description}</p>
                                  <span className={`text-[9px] block mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600 font-semibold'}`}>
                                    {getDaysAgo(evt.timestamp)} • Dispatch Auth: {evt.by}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Voting Module */}
                        {issue.status !== 'resolved' && issue.status !== 'closed' && (
                          <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border ${
                            theme === 'dark' 
                              ? 'bg-slate-500/5 border-slate-800/40' 
                              : 'bg-slate-100/90 border-slate-300/80 shadow-xs'
                          }`}>
                            <div>
                              <h4 className={`text-xs font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-extrabold'}`}>
                                <Clock className="w-4 h-4 text-indigo-500" />
                                Community Verification Threshold
                              </h4>
                              <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-750 font-semibold'}`}>
                                Current Support: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{confidenceScore} Support votes</span> (Requires +2 Support to assign SLA Crew)
                              </p>
                            </div>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => onVote(issue.id, 'valid')}
                                className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" /> Mark Valid (+10 Points)
                              </button>
                              <button
                                onClick={() => onVote(issue.id, 'invalid')}
                                className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-rose-500 border border-rose-500/20 hover:bg-rose-500/10 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                            <div className="flex gap-2 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 border-slate-200 dark:border-slate-800">
                              <button
                                onClick={() => {
                                  const url = `${window.location.origin}${window.location.pathname}?issueId=${issue.id}`;
                                  navigator.clipboard.writeText(url);
                                  alert('Link copied to clipboard!');
                                }}
                                className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Share2 className="w-3.5 h-3.5" /> Share Link
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Interactive Discussions */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h4 className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                              theme === 'dark' ? 'text-slate-500' : 'text-slate-750 font-extrabold'
                            }`}>
                              <MessageSquare className="w-3.5 h-3.5" /> Constructive Discussion ({issue.comments?.length || 0})
                            </h4>
                          </div>

                          {/* Comment Input */}
                          <form onSubmit={(e) => handleCommentSubmit(issue.id, e)} className="flex gap-2 mb-3">
                            <input
                              type="text"
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Provide supportive details, safety advice, or coordinates clarification..."
                              className={`flex-1 text-xs px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                theme === 'dark' 
                                  ? 'border-slate-800 bg-slate-950/45 text-slate-100 placeholder-slate-600' 
                                  : 'border-slate-300 bg-white/85 text-slate-900 placeholder-slate-500 font-medium shadow-xs'
                              }`}
                            />
                            <button
                              type="submit"
                              className="px-3.5 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-all cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </form>

                          {/* Comment list */}
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {issue.comments?.length === 0 ? (
                              <span className={`text-[10px] block italic text-center py-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-semibold'}`}>No comments logged. Keep discussion constructive.</span>
                            ) : (
                              issue.comments?.map((c) => (
                                <div key={c.id} className={`p-2.5 rounded-lg border text-xs ${
                                  theme === 'dark' 
                                    ? 'bg-slate-900/30 border-slate-800/30' 
                                    : 'bg-white/80 border-slate-200/60 shadow-xs'
                                }`}>
                                  <div className="flex justify-between items-center mb-1 text-[9px]">
                                    <span className={`font-bold flex items-center gap-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-extrabold'}`}>
                                      <User className="w-3 h-3 text-indigo-400" />
                                      {c.userName} ({c.userRole})
                                    </span>
                                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-bold'}>{getDaysAgo(c.createdAt)}</span>
                                  </div>
                                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800 font-medium'}`}>{c.text}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 2: COMMUNITY BOARD (Interactive Social Feed & Announcements)
          ──────────────────────────────────────────────────────────────────────── */}
      {hubTab === 'board' && (
        <motion.div
          key="board-hub"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex flex-col gap-4"
        >
          {/* Post Creation Toggle Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900 font-extrabold'}`}>📢 Announcements & Volunteer Hub</h2>
              <p className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>Share community achievements, coordinate local action, and review public alerts.</p>
            </div>
            <button
              id="btn-create-post"
              onClick={() => setIsCreatingPost(!isCreatingPost)}
              className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              {isCreatingPost ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isCreatingPost ? 'Close' : 'Create Post'}
            </button>
          </div>

          {/* Create Post Card */}
          <AnimatePresence>
            {isCreatingPost && (
              <motion.form
                id="create-post-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreatePost}
                className={`p-4 rounded-2xl border space-y-3.5 ${
                  theme === 'dark' ? 'bg-slate-900/90 border-indigo-500/40' : 'bg-white border-slate-300 shadow-md'
                }`}
              >
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Post Title</label>
                  <input
                    type="text"
                    required
                    value={postTitle}
                    onChange={e => setPostTitle(e.target.value)}
                    placeholder="e.g., Volunteer Plantation Drive this Friday!"
                    className={`w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Tag / Category</label>
                    <select
                      value={postTag}
                      onChange={e => setPostTag(e.target.value as any)}
                      className={`w-full text-xs p-2.5 rounded-xl border focus:outline-none ${
                        theme === 'dark' ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="#general">💬 #general (Chitchat)</option>
                      <option value="#volunteering">🌱 #volunteering (Local events)</option>
                      <option value="#praise">👏 #praise (Success stories)</option>
                      <option value="#announcement">📢 #announcement (Official notices)</option>
                      <option value="#alert">🚨 #alert (Critical updates)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Cover Image URL (Optional)</label>
                    <input
                      type="url"
                      value={postImageUrl}
                      onChange={e => setPostImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className={`w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        theme === 'dark' ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Post Content</label>
                  <textarea
                    required
                    rows={4}
                    value={postContent}
                    onChange={e => setPostContent(e.target.value)}
                    placeholder="Tell your neighbors what is happening or what assistance you need..."
                    className={`w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingPost(false)}
                    className="py-2 px-4 rounded-xl text-xs font-bold border border-slate-300 hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-bold text-xs shadow-md cursor-pointer"
                  >
                    Publish Announcement
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Board Filters & Search Row */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <input
                type="text"
                value={boardSearchQuery}
                onChange={e => setBoardSearchQuery(e.target.value)}
                placeholder="Search board stories..."
                className={`w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none ${
                  theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {['all', '#general', '#volunteering', '#praise', '#announcement', '#alert'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setBoardTagFilter(tag)}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    boardTagFilter === tag
                      ? 'bg-indigo-600 text-white border-indigo-500/50'
                      : theme === 'dark'
                        ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'
                  }`}
                >
                  {tag === 'all' ? '🏷 All Tags' : tag}
                </button>
              ))}
            </div>
          </div>

          {/* Board Feed Stream */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {filteredBoardPosts.length === 0 ? (
              <div className={`p-8 text-center rounded-2xl border col-span-full ${
                theme === 'dark' ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-100'
              }`}>
                <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-xs font-bold">No announcements matching filters</p>
                <p className="text-[10px] text-slate-500 mt-1">Be the first to share an update with your neighborhood!</p>
              </div>
            ) : (
              filteredBoardPosts.map(post => {
                const postColorMap: Record<string, string> = {
                  '#volunteering': 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10',
                  '#praise': 'text-purple-500 border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/10',
                  '#announcement': 'text-sky-500 border-sky-500/20 bg-sky-500/5 dark:bg-sky-500/10',
                  '#alert': 'text-rose-500 border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10',
                  '#general': 'text-slate-400 border-slate-500/20 bg-slate-500/5 dark:bg-slate-500/10'
                };

                return (
                  <div
                    key={post.id}
                    id={`post-card-${post.id}`}
                    className={`p-4 rounded-2xl border space-y-3.5 transition-all duration-300 ${
                      theme === 'dark'
                        ? 'bg-white/4 border-white/5 hover:border-white/10'
                        : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                    }`}
                  >
                    {/* Header Author Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white bg-indigo-500`}>
                          {post.authorName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-extrabold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{post.authorName}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                              post.authorRole === 'authority' 
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}>
                              {post.authorRole}
                            </span>
                          </div>
                          <p className={`text-[9px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400 font-bold'}`}>{getDaysAgo(post.createdAt)}</p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-lg border ${postColorMap[post.tag] || ''}`}>
                        {post.tag}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                      <h3 className={`text-sm font-bold leading-snug ${theme === 'dark' ? 'text-white' : 'text-slate-900 font-extrabold'}`}>
                        {post.title}
                      </h3>
                      <p className={`text-xs whitespace-pre-wrap ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700 font-medium'}`}>
                        {post.content}
                      </p>
                      
                      {post.imageUrl && (
                        <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/5 bg-slate-900 mt-2">
                          <img src={post.imageUrl} alt={post.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    {/* Reactions, Likes & Comments Count Row */}
                    <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5 gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleLikePost(post.id)}
                          className={`flex items-center gap-1 py-1 px-2.5 rounded-lg border transition-all cursor-pointer ${
                            post.likedByUser
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 font-extrabold'
                              : 'hover:bg-slate-100 dark:hover:bg-white/5 border-transparent text-slate-500'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${post.likedByUser ? 'fill-rose-500 text-rose-500' : ''}`} />
                          <span>{post.likes}</span>
                        </button>

                        {/* Preset Reactions */}
                        <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-white/5 pl-3">
                          {['🎉', '👏', '❤️'].map(emoji => {
                            const count = post.reactions[emoji] || 0;
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleAddReaction(post.id, emoji)}
                                className="hover:scale-125 transition-transform p-1 cursor-pointer"
                                title={`React with ${emoji}`}
                              >
                                <span>{emoji}</span>
                                {count > 0 && <span className="text-[10px] ml-0.5 font-bold text-slate-500">{count}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        onClick={() => setExpandedBoardComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                        className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer ${
                          expandedBoardComments[post.id] 
                            ? 'text-indigo-500 bg-indigo-500/5' 
                            : theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                        }`}
                        title="Toggle responses"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{post.comments.length} Comments logged</span>
                        <span className="text-[8px] opacity-60 ml-0.5">
                          {expandedBoardComments[post.id] ? "▲ Hide" : "▼ Show"}
                        </span>
                      </button>
                    </div>

                    {/* Board Comments list (collapsible) */}
                    {expandedBoardComments[post.id] && (
                      <div className="space-y-2 mt-3 pt-3 border-t border-slate-200/50 dark:border-white/5 animate-fadeIn">
                        {post.comments.length === 0 ? (
                          <p className={`text-[10px] italic py-2 text-center ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            No responses logged yet. Be the first to start the conversation!
                          </p>
                        ) : (
                          post.comments.map(c => (
                            <div key={c.id} className={`p-2.5 rounded-lg text-xs border ${
                              theme === 'dark' ? 'bg-slate-950/40 border-white/5' : 'bg-slate-50 border-slate-200/50'
                            }`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1 text-[9px] font-bold">
                                  <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-900 font-extrabold'}>{c.authorName}</span>
                                  <span className="opacity-50">•</span>
                                  <span className={`uppercase tracking-widest text-[8px] px-1 rounded border ${
                                    c.authorRole === 'authority' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15' : 'bg-slate-500/10 text-slate-400 border-slate-500/15'
                                  }`}>{c.authorRole}</span>
                                </div>
                                <span className={`text-[9px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{getDaysAgo(c.createdAt)}</span>
                              </div>
                              <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700 font-medium'}`}>{c.text}</p>
                            </div>
                          ))
                        )}

                        {/* Comment Form */}
                        <form onSubmit={(e) => handleAddBoardComment(post.id, e)} className="flex gap-2 pt-1.5">
                          <input
                            type="text"
                            required
                            value={postCommentTexts[post.id] || ''}
                            onChange={e => setPostCommentTexts({ ...postCommentTexts, [post.id]: e.target.value })}
                            placeholder="Type a constructive response..."
                            className={`flex-1 text-xs px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                              theme === 'dark' ? 'bg-slate-950 border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                          />
                          <button
                            type="submit"
                            className="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-all cursor-pointer shadow-xs"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 3: STREAM-LIKE LIVE CIVIC CHAT
          ──────────────────────────────────────────────────────────────────────── */}
      {hubTab === 'chat' && (
        <motion.div
          key="chat-hub"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`grid grid-cols-1 lg:grid-cols-4 rounded-2xl border overflow-hidden h-[480px] ${
            theme === 'dark' ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-md'
          }`}
        >
          {/* Chat Left Sidebar: Channels list */}
          <div className={`hidden lg:flex col-span-1 border-r flex-col justify-between ${
            theme === 'dark' ? 'border-white/10 bg-slate-950/20' : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="p-3 space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Civic Rooms</span>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setIsJoiningRoom(true)}
                    title="Join Public Room"
                    className="p-1 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setIsCreatingRoom(true)}
                    title="Create Room"
                    className="p-1 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {Object.keys(chatMessages).map(ch => {
                  const isActive = activeChannel === ch;
                  const desc = roomDescriptions[ch] || 'Custom citizen room';

                  return (
                    <button
                      key={ch}
                      onClick={() => setActiveChannel(ch)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                        isActive
                          ? 'bg-indigo-600 text-white font-bold shadow-md'
                          : theme === 'dark'
                            ? 'text-slate-400 hover:text-white hover:bg-white/5'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      <div className="flex flex-col truncate w-full">
                        <span className="text-xs font-bold truncate flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 shrink-0" />
                          {ch.replace('#', '')}
                        </span>
                        <span className={`text-[9px] truncate mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                          {desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current user mini card */}
            <div className={`p-3.5 border-t flex items-center gap-2.5 ${theme === 'dark' ? 'border-white/10 bg-slate-950/45' : 'border-slate-200 bg-white'}`}>
              <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                {(currentUser?.name || 'You').charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold truncate">{currentUser?.name || 'You (Citizen)'}</p>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] text-emerald-500 font-extrabold uppercase tracking-wider">Online Lounge</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Center Pane: Message Log & Input */}
          <div className="col-span-1 lg:col-span-2 flex flex-col justify-between h-full relative bg-transparent min-w-0">
            {/* Mobile Channel Tabs selector */}
            <div className={`lg:hidden flex items-center gap-2 p-2 overflow-x-auto border-b shrink-0`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {Object.keys(chatMessages).map(ch => {
                const isActive = activeChannel === ch;
                return (
                  <button
                    key={ch}
                    onClick={() => setActiveChannel(ch)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : theme === 'dark'
                          ? 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                          : 'bg-slate-150 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    #{ch.replace('#', '')}
                  </button>
                );
              })}
              <button
                onClick={() => setIsJoiningRoom(true)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all cursor-pointer bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/20"
                title="Join Public Room"
              >
                + Join Room
              </button>
              <button
                onClick={() => setIsCreatingRoom(true)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all cursor-pointer bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/20"
                title="Create Custom Room"
              >
                + Create Room
              </button>
            </div>

            {/* Channel Title */}
            <div className={`p-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10 bg-slate-950/10' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-indigo-500" />
                <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {activeChannel.replace('#', '')}
                </span>
              </div>
              <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Stream Native Engine
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[360px]">
              {(chatMessages[activeChannel] || []).map(msg => {
                const isMe = msg.senderName.includes('You');
                
                return (
                  <div key={msg.id} className={`flex gap-2.5 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {msg.senderName.charAt(0)}
                      </div>
                    )}
                    
                    {/* Speech Bubble */}
                    <div className="space-y-0.5">
                      <div className={`flex items-center gap-1.5 text-[9px] ${isMe ? 'justify-end' : ''}`}>
                        <span className={`font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800 font-extrabold'}`}>{msg.senderName}</span>
                        <span className={`uppercase text-[7px] px-1 rounded border opacity-60 ${
                          msg.senderRole === 'authority' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/10' : 'bg-slate-500/15 text-slate-400 border-slate-500/10'
                        }`}>{msg.senderRole}</span>
                      </div>
                      
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isMe 
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-tr-none shadow-md' 
                          : theme === 'dark'
                            ? 'bg-white/5 border border-white/5 text-slate-100 rounded-tl-none'
                            : 'bg-slate-100 border border-slate-200/50 text-slate-800 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing simulation container */}
              {typingUser && (
                <div className="flex gap-2.5 items-center max-w-[80%]">
                  <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 animate-pulse">
                    {typingUser.charAt(0)}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400">{typingUser}</span>
                    <div className={`p-2.5 rounded-2xl rounded-tl-none text-xs flex items-center gap-1 ${
                      theme === 'dark' ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className="text-[10px] font-semibold italic">typing</span>
                      <span className="flex gap-0.5 items-center">
                        <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Chat message input form */}
            <form onSubmit={handleSendChatMessage} className={`p-3 border-t flex gap-2 ${theme === 'dark' ? 'border-white/10 bg-slate-950/15' : 'border-slate-200 bg-slate-50'}`}>
              <input
                type="text"
                required
                disabled={typingUser !== null}
                value={typedMessage}
                onChange={e => setTypedMessage(e.target.value)}
                placeholder={typingUser ? "Waiting for response..." : "Type a message in this channel..."}
                className={`flex-1 text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                  theme === 'dark' 
                    ? 'bg-slate-950 border-white/10 text-white placeholder-slate-600 disabled:opacity-50' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 disabled:opacity-50'
                }`}
              />
              <button
                type="submit"
                disabled={typingUser !== null}
                className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white transition-all cursor-pointer shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Chat Right Sidebar: Online Citizens */}
          <div className={`hidden lg:flex col-span-1 flex-col p-3.5 space-y-3 ${
            theme === 'dark' ? 'bg-slate-950/10' : 'bg-slate-50/50'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Room Citizens</span>
              <span className="text-[10px] font-bold text-indigo-500">{activeChannelCitizens.length} Members</span>
            </div>
            
            <div className="space-y-2.5 flex-1 overflow-y-auto">
              {activeChannelCitizens.map(user => {
                const isOnline = user.status === 'online';
                const isAway = user.status === 'away';

                return (
                  <div key={user.name} className="flex items-center justify-between text-xs animate-fade-in">
                    <div className="flex items-center gap-2">
                      <div className={`w-6.5 h-6.5 rounded-full ${user.avatarColor || 'bg-indigo-500'} text-white flex items-center justify-center font-bold text-[10px]`}>
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold truncate max-w-[110px]">{user.name}</p>
                        <span className="text-[8px] uppercase tracking-widest text-slate-500">{user.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isOnline ? 'bg-emerald-500' : isAway ? 'bg-amber-400' : 'bg-slate-500'
                      }`}></span>
                      <span className="text-[8.5px] uppercase tracking-wider text-slate-500">{user.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className={`p-2.5 rounded-xl border text-[10px] ${
              theme === 'dark' ? 'bg-white/2 border-white/5 text-slate-400' : 'bg-indigo-50/50 border-indigo-100 text-indigo-950 font-medium'
            }`}>
              💡 <span className="font-bold">Pro-tip:</span> Ask about cleanups, power, or flooding to trigger smart citizen coordination!
            </div>
          </div>

          {/* Create Room Modal */}
          <AnimatePresence>
            {isCreatingRoom && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 15 }}
                  className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl relative ${
                    theme === 'dark' ? 'bg-slate-905 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                  style={{ backgroundColor: theme === 'dark' ? '#111827' : '#ffffff' }}
                >
                  <button
                    onClick={() => setIsCreatingRoom(false)}
                    className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-slate-500 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Create Civic Room</h3>
                      <p className="text-xs text-slate-400">Launch a new public room for neighborhood coordination</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateRoom} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Room Name</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2 text-slate-500 font-bold text-sm">#</span>
                        <input
                          type="text"
                          required
                          placeholder="e.g. ward-12-cleanups"
                          value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                          className={`w-full pl-8 pr-4 py-2 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                            theme === 'dark' ? 'bg-slate-950/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Topic / Description</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Describe what citizens should coordinate or talk about in this room..."
                        value={newRoomDesc}
                        onChange={(e) => setNewRoomDesc(e.target.value)}
                        className={`w-full px-4 py-2 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none ${
                          theme === 'dark' ? 'bg-slate-950/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingRoom(false)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                          theme === 'dark' ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                      >
                        Create & Join
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Join Room Modal */}
          <AnimatePresence>
            {isJoiningRoom && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 15 }}
                  className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl relative ${
                    theme === 'dark' ? 'bg-slate-905 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                  style={{ backgroundColor: theme === 'dark' ? '#111827' : '#ffffff' }}
                >
                  <button
                    onClick={() => setIsJoiningRoom(false)}
                    className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-slate-500 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                      <Search className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Join Public Room</h3>
                      <p className="text-xs text-slate-400">Discover and join other neighborhood discussion rooms</p>
                    </div>
                  </div>

                  {/* Dynamic room filter / search */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search or enter custom room name..."
                        value={joiningRoomSearch}
                        onChange={(e) => setJoiningRoomSearch(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                          theme === 'dark' ? 'bg-slate-950/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    {/* Available Public Rooms list */}
                    <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                      {joinablePublicRooms
                        .filter(r => r.name.toLowerCase().includes(joiningRoomSearch.toLowerCase()) || r.description.toLowerCase().includes(joiningRoomSearch.toLowerCase()))
                        .map(r => (
                          <div
                            key={r.name}
                            onClick={() => handleJoinRoom(r.name, r.description)}
                            className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] ${
                              theme === 'dark'
                                ? 'bg-slate-950/30 border-white/5 hover:bg-slate-950/65 hover:border-white/10'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <div className="truncate flex-1 pr-3">
                              <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5 shrink-0" />
                                {r.name.replace('#', '')}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{r.description}</p>
                            </div>
                            <span className="text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-lg">JOIN</span>
                          </div>
                        ))}

                      {/* If searched name is not in public list, show quick create/join option */}
                      {joiningRoomSearch.trim().length > 1 && !joinablePublicRooms.some(r => r.name.toLowerCase() === ('#' + joiningRoomSearch.trim().toLowerCase().replace('#', ''))) && (
                        <div
                          onClick={() => {
                            let cleanSearch = joiningRoomSearch.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
                            if (!cleanSearch.startsWith('#')) cleanSearch = '#' + cleanSearch;
                            handleJoinRoom(cleanSearch, 'Custom discussion room');
                            setJoiningRoomSearch('');
                          }}
                          className={`p-3 rounded-2xl border-dashed border-2 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] ${
                            theme === 'dark'
                              ? 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/5'
                              : 'border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/5'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" />
                              Join & Launch: #{joiningRoomSearch.trim().toLowerCase().replace('#', '')}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Initialize a custom channel instantly</p>
                          </div>
                          <span className="text-[10px] font-black bg-indigo-500 text-white px-2.5 py-1 rounded-lg">GO</span>
                        </div>
                      )}

                      {joinablePublicRooms.filter(r => r.name.toLowerCase().includes(joiningRoomSearch.toLowerCase()) || r.description.toLowerCase().includes(joiningRoomSearch.toLowerCase())).length === 0 && joiningRoomSearch.trim().length === 0 && (
                        <p className="text-center text-xs text-slate-500 py-4">All standard neighborhood channels have been joined!</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        💡 <span className="font-bold">Note:</span> Creating or joining a discussion room allows you to immediately coordinate with online neighborhood citizens and invite our AI Bot to help find solutions!
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

    </div>
  );
}
