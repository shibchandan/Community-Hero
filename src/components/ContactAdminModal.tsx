import React, { useState, useEffect } from 'react';
import { 
  X, Send, CheckCircle, MessageSquare, Clock, User, 
  Mail, PlusCircle, ChevronRight, AlertCircle, Filter, Sparkles, LifeBuoy
} from 'lucide-react';
import { User as UserType, ContactMessage } from '../types';

interface ContactAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
  theme: 'dark' | 'light';
}

export default function ContactAdminModal({ isOpen, onClose, currentUser, theme }: ContactAdminModalProps) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'feedback' | 'bug' | 'support' | 'other'>('support');
  const [message, setMessage] = useState('');
  
  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  
  // Admin response state
  const [selectedTicket, setSelectedTicket] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const isAdmin = currentUser?.email?.toLowerCase() === 'shibchandan11@gmail.com';

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setEmail(currentUser.email);
    }
  }, [currentUser]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contact');
      if (response.ok) {
        const data = await response.json();
        // Sort by newest first
        data.sort((a: ContactMessage, b: ContactMessage) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // Filter by user's email if they are not an admin
        if (isAdmin) {
          setMessages(data);
        } else if (currentUser?.email) {
          setMessages(data.filter((t: ContactMessage) => t.email.toLowerCase() === currentUser.email.toLowerCase()));
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
      if (isAdmin) {
        setActiveTab('history'); // Default admin to ticket list
      } else {
        setActiveTab('new');
      }
      setSuccessMsg('');
    }
  }, [isOpen, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !subject || !message) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, category, message })
      });

      if (response.ok) {
        const resData = await response.json();
        setSuccessMsg(`Ticket #${resData.ticket.id.split('_')[1] || 'ST'} submitted successfully! Admin Shibchandan has been notified.`);
        setSubject('');
        setMessage('');
        fetchTickets();
        // Stagger tab transition
        setTimeout(() => {
          setActiveTab('history');
          setSuccessMsg('');
        }, 3000);
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to submit message.');
      }
    } catch (err) {
      console.error('Error submitting contact ticket:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    setReplySubmitting(true);
    try {
      const response = await fetch(`/api/contact/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText })
      });

      if (response.ok) {
        const data = await response.json();
        // Update the ticket locally
        setMessages(prev => prev.map(m => m.id === ticketId ? data.ticket : m));
        setSelectedTicket(data.ticket);
        setReplyText('');
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to submit reply.');
      }
    } catch (err) {
      console.error('Error replying to ticket:', err);
    } finally {
      setReplySubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className={`relative w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-900 border-white/10 text-white' 
          : 'bg-white border-slate-200 text-slate-800'
      }`}>
        
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          theme === 'dark' ? 'border-white/5 bg-slate-950/40' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <LifeBuoy className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-extrabold tracking-tight text-base flex items-center gap-2">
                Contact Admin & Support Desk
                {isAdmin && (
                  <span className="text-[9px] bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Admin Portal
                  </span>
                )}
              </h3>
              <p className="text-xs opacity-70">
                {isAdmin ? 'Manage and reply to community support queries' : 'Have feedback or a bug to report? Message Admin Shibchandan directly.'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              theme === 'dark' ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area split by Tabs */}
        {!isAdmin && (
          <div className={`flex border-b text-xs ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-3 text-center font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
                activeTab === 'new' 
                  ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5' 
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              New Message
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-center font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
                activeTab === 'history' 
                  ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5' 
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              Ticket History ({messages.length})
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 flex items-start gap-3 animate-scaleIn">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <h4 className="font-bold text-sm text-emerald-300">Message Dispatched!</h4>
                <p className="text-xs opacity-90 mt-0.5">{successMsg}</p>
              </div>
            </div>
          )}

          {activeTab === 'new' && !isAdmin ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 opacity-45" />
                    <input 
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      disabled={!!currentUser}
                      className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 ${
                        theme === 'dark' 
                          ? 'bg-slate-950 border-white/10 text-white focus:border-emerald-500 focus:ring-emerald-500/50' 
                          : 'bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/50'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                    Your Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 opacity-45" />
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. john@example.com"
                      disabled={!!currentUser}
                      className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 ${
                        theme === 'dark' 
                          ? 'bg-slate-950 border-white/10 text-white focus:border-emerald-500 focus:ring-emerald-500/50' 
                          : 'bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/50'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                    Subject Heading
                  </label>
                  <input 
                    type="text"
                    required
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Brief summary of your query"
                    className={`w-full px-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 ${
                      theme === 'dark' 
                        ? 'bg-slate-950 border-white/10 focus:border-emerald-500 focus:ring-emerald-500/50' 
                        : 'bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/50'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                    Category Type
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className={`w-full px-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-slate-950 border-white/10 focus:border-emerald-500 focus:ring-emerald-500/50' 
                        : 'bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/50'
                    }`}
                  >
                    <option value="support">Technical Support</option>
                    <option value="feedback">General Feedback</option>
                    <option value="bug">Bug Report</option>
                    <option value="other">Other Inquiry</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                  Detailed Message
                </label>
                <textarea 
                  required
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Provide complete details so the admin team can investigate your request."
                  className={`w-full px-4 py-3 text-xs rounded-xl border focus:outline-none focus:ring-1 ${
                    theme === 'dark' 
                      ? 'bg-slate-950 border-white/10 focus:border-emerald-500 focus:ring-emerald-500/50' 
                      : 'bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/50'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] opacity-60 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Your message goes directly to Shibchandan's system dashboard.
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          ) : (
            /* History & Message Management (Includes Admin portal view) */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full min-h-[350px]">
              
              {/* Left Column: List of Tickets */}
              <div className={`md:col-span-5 space-y-2 border-r pr-4 ${
                theme === 'dark' ? 'border-white/5' : 'border-slate-100'
              } overflow-y-auto max-h-[450px]`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-60">
                    {isAdmin ? 'All Citizen Queries' : 'Your Past Queries'}
                  </span>
                  <button 
                    onClick={fetchTickets}
                    className="text-[10px] font-bold text-emerald-500 hover:underline cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-xs opacity-50">Loading desk list...</div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-xs opacity-50 flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-slate-400" />
                    <span>No queries found.</span>
                  </div>
                ) : (
                  messages.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTicket(t); setReplyText(''); }}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 relative group cursor-pointer ${
                        selectedTicket?.id === t.id
                          ? theme === 'dark'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                            : 'bg-emerald-50/70 border-emerald-500/30 text-emerald-950'
                          : theme === 'dark'
                            ? 'bg-slate-950/40 border-white/5 hover:border-white/15'
                            : 'bg-slate-50 border-slate-200/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          t.category === 'bug' ? 'bg-red-500/10 text-red-400' :
                          t.category === 'feedback' ? 'bg-indigo-500/10 text-indigo-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {t.category}
                        </span>
                        
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                          t.status === 'resolved' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                        }`}>
                          {t.status === 'resolved' ? 'RESOLVED' : 'PENDING'}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-bold truncate pr-3">{t.subject}</h4>
                      <div className="flex items-center gap-1.5 mt-2 text-[9px] opacity-60">
                        <User className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[80px]">{t.name}</span>
                        <span>•</span>
                        <Clock className="w-2.5 h-2.5" />
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                      <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))
                )}
              </div>

              {/* Right Column: Ticket Detail & Admin Reply Box */}
              <div className="md:col-span-7 flex flex-col h-full justify-between max-h-[450px]">
                {selectedTicket ? (
                  <div className="flex flex-col h-full space-y-4">
                    <div className={`p-4 rounded-xl border ${
                      theme === 'dark' ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50/80 border-slate-100'
                    } overflow-y-auto max-h-[250px]`}>
                      <div className="flex items-start justify-between gap-3 mb-2 pb-2 border-b border-dashed border-slate-500/20">
                        <div>
                          <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest">
                            Ticket #{selectedTicket.id.split('_')[1] || 'ST'}
                          </h4>
                          <h3 className="text-sm font-extrabold mt-0.5">{selectedTicket.subject}</h3>
                        </div>
                        <span className="text-[10px] opacity-65 shrink-0">
                          {new Date(selectedTicket.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 opacity-80 text-[10px] font-mono">
                          <span>From: {selectedTicket.name} ({selectedTicket.email})</span>
                        </div>
                        <p className="opacity-90 leading-relaxed py-1 bg-white/5 px-2 rounded font-mono text-[11px] whitespace-pre-wrap">
                          {selectedTicket.message}
                        </p>
                      </div>

                      {selectedTicket.replyText && (
                        <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl space-y-1 animate-scaleIn">
                          <div className="flex items-center justify-between text-[9px] font-bold text-emerald-400">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 animate-pulse" />
                              Official Reply from Admin Shibchandan
                            </span>
                            <span>{new Date(selectedTicket.repliedAt || '').toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-white/95 leading-relaxed font-mono italic">
                            "{selectedTicket.replyText}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Admin Reply Input Box */}
                    {isAdmin && selectedTicket.status === 'pending' && (
                      <div className="space-y-2 pt-2 border-t border-dashed border-slate-500/20">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Respond as Admin Shibchandan
                        </label>
                        <div className="flex gap-2">
                          <textarea
                            required
                            rows={2}
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Type official support response..."
                            className={`flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none ${
                              theme === 'dark' 
                                ? 'bg-slate-950 border-white/10 focus:border-emerald-500' 
                                : 'bg-slate-50 border-slate-200 focus:border-emerald-500'
                            }`}
                          />
                          <button
                            onClick={() => handleSendReply(selectedTicket.id)}
                            disabled={replySubmitting || !replyText.trim()}
                            className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0"
                          >
                            {replySubmitting ? '...' : <Send className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-45 py-20 text-center text-xs">
                    <MessageSquare className="w-10 h-10 mb-2 text-slate-400 animate-pulse" />
                    <span>Select a ticket from the left column to view description, status, and responses.</span>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className={`px-6 py-3 border-t text-[10px] flex items-center justify-between ${
          theme === 'dark' ? 'border-white/5 bg-slate-950/20 text-gray-500' : 'border-slate-100 bg-slate-50 text-slate-400'
        }`}>
          <span>Samadhan Setu Digital Governance Desk v2.6</span>
          <span>🔒 End-to-End Secure Communications</span>
        </div>

      </div>
    </div>
  );
}
