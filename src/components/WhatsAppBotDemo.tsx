/**
 * WhatsAppBotDemo Component
 * An interactive in-browser demo of the WhatsApp civic reporting chatbot.
 * Calls POST /api/whatsapp/test to simulate the conversation flow.
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Send, RefreshCw, Smartphone, Bot, User, Info } from 'lucide-react';

interface Props {
  theme: 'dark' | 'light';
}

interface Message {
  id: string;
  from: 'user' | 'bot';
  text: string;
  timestamp: string;
}

const DEMO_PHONE = '+91-98XXXXXXXX';

const QUICK_REPLIES = [
  'REPORT pothole',
  'REPORT garbage not collected',
  'REPORT streetlight broken',
  'REPORT water pipe leak',
  'REPORT flooding near drain',
  'SKIP',
  'CANCEL',
];

export function WhatsAppBotDemo({ theme }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      from: 'bot',
      text: '🏙️ *Samadhan Setu Civic Bot*\n\nSend *REPORT* to report a civic issue.\nExamples:\n• REPORT pothole\n• REPORT garbage not collected\n• REPORT streetlight broken\n\n_Powered by AI • Your reports matter!_',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `demo_${Date.now()}`);
  const [expanded, setExpanded] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || loading) return;
    setInput('');

    const userMsg: Message = {
      id: 'u_' + Date.now(),
      from: 'user',
      text: msgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgText, from: sessionId }),
      });
      const data = await res.json();
      const botMsg: Message = {
        id: 'b_' + Date.now(),
        from: 'bot',
        text: data.reply || 'An error occurred.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: 'err_' + Date.now(),
        from: 'bot',
        text: '⚠️ Could not reach the bot server. Is the dev server running?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([{
      id: 'welcome_' + Date.now(),
      from: 'bot',
      text: '🏙️ *Samadhan Setu Civic Bot*\n\nSend *REPORT* to report a civic issue.\nExamples:\n• REPORT pothole\n• REPORT garbage not collected\n• REPORT streetlight broken\n\n_Powered by AI • Your reports matter!_',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    // Send a dummy message to reset server-side session
    fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'CANCEL', from: sessionId }),
    }).catch(() => {});
  };

  const formatText = (text: string) => {
    return text
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  const card = theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-xl font-black font-display flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <MessageCircle className="w-5 h-5 text-green-400" />
            WhatsApp Civic Bot
          </h2>
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Interactive demo · Powered by Twilio · Real conversation state machine
          </p>
        </div>
        <button
          onClick={reset}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            theme === 'dark' ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" /> New Conversation
        </button>
      </div>

      {/* Collapsible Developer Integration Sandbox */}
      <div className={`p-4 rounded-xl border transition-all ${
        theme === 'dark' 
          ? 'bg-indigo-950/10 border-indigo-500/20 hover:border-indigo-500/30' 
          : 'bg-indigo-50/30 border-indigo-200 hover:border-indigo-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className={`text-xs font-black uppercase tracking-wider ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-800'}`}>
              🔌 Twilio Webhook & Integration Settings
            </h3>
          </div>
          <button
            onClick={() => setExpanded(expanded === 'developer-sandbox' ? null : 'developer-sandbox')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              expanded === 'developer-sandbox'
                ? 'bg-indigo-500/20 text-indigo-400'
                : theme === 'dark'
                  ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {expanded === 'developer-sandbox' ? 'Hide Setup' : 'Show Integration Guide'}
          </button>
        </div>

        <AnimatePresence>
          {expanded === 'developer-sandbox' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-3 border-t border-dashed border-indigo-500/15 space-y-4">
                <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  The backend for this WhatsApp bot is fully operational and production-ready. You can connect a real WhatsApp number using Twilio's Sandbox or Business API to receive and reply to real-time citizen reports:
                </p>

                {/* Webhook Endpoint Box */}
                <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Your Real-time Webhook URL</p>
                  <div className="flex items-center justify-between gap-3 font-mono text-xs">
                    <span className="text-emerald-400 font-bold truncate">
                      {window.location.origin}/api/whatsapp/webhook
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`);
                        alert('Copied to clipboard!');
                      }}
                      className="shrink-0 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-[10px] rounded transition-all cursor-pointer"
                    >
                      Copy URL
                    </button>
                  </div>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { step: '1', title: 'Twilio Console', desc: 'Create a free Twilio Account and open the Twilio Sandbox for WhatsApp.' },
                    { step: '2', title: 'Paste Webhook', desc: 'Configure the incoming message webhook and select HTTP POST with the URL above.' },
                    { step: '3', title: 'Live Chat', desc: 'Send "join [your sandbox keyword]" to the Twilio number, then chat normally!' },
                  ].map(s => (
                    <div key={s.step} className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-black flex items-center justify-center">
                          {s.step}
                        </span>
                        <h4 className={`text-xs font-black ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{s.title}</h4>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Window */}
        <div className="lg:col-span-2">
          <div className={`rounded-2xl border overflow-hidden ${card}`}>
            {/* WhatsApp Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-green-600">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Samadhan Setu Bot</p>
                <p className="text-[10px] text-green-100">Online • Twilio WhatsApp</p>
              </div>
              <Smartphone className="w-4 h-4 text-green-100 ml-auto" />
            </div>

            {/* Messages */}
            <div
              className={`h-96 overflow-y-auto p-4 space-y-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}
              style={{ backgroundImage: theme === 'dark' ? 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.02) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(255,255,255,0.02) 2%, transparent 0%)' : undefined, backgroundSize: '100px 100px' }}
            >
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.from === 'bot' && (
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-2 mt-1 shrink-0">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        msg.from === 'user'
                          ? 'bg-green-500 text-white rounded-br-sm'
                          : theme === 'dark'
                            ? 'bg-slate-800 text-slate-100 rounded-bl-sm'
                            : 'bg-white text-slate-800 rounded-bl-sm'
                      }`}
                    >
                      <div dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
                      <p className={`text-[9px] mt-1 text-right ${msg.from === 'user' ? 'text-green-100' : theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {msg.timestamp}
                      </p>
                    </div>
                    {msg.from === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center ml-2 mt-1 shrink-0">
                        <User className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {loading && (
                <div className="flex justify-start">
                  <div className={`px-4 py-2 rounded-2xl rounded-bl-sm text-sm ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
                    <span className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className={`flex items-center gap-2 px-3 py-2 border-t ${theme === 'dark' ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className={`flex-1 text-sm px-3 py-2 rounded-xl border bg-transparent focus:outline-none ${
                  theme === 'dark' ? 'border-white/10 text-white placeholder-slate-500' : 'border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-green-500 hover:bg-green-400 text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Replies + Info */}
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border ${card}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              Quick Replies
            </p>
            <div className="flex flex-col gap-2">
              {QUICK_REPLIES.map(qr => (
                <button
                  key={qr}
                  onClick={() => sendMessage(qr)}
                  disabled={loading}
                  className={`text-left text-xs px-3 py-2 rounded-xl border transition-all cursor-pointer disabled:opacity-40 ${
                    theme === 'dark'
                      ? 'border-white/10 hover:bg-white/5 text-slate-300'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {qr}
                </button>
              ))}
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${card}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              Simulated As
            </p>
            <div className={`flex items-center gap-2 p-2 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
              <Smartphone className="w-4 h-4 text-green-400" />
              <span className={`text-xs font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{DEMO_PHONE}</span>
            </div>
            <p className={`text-[10px] mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Each browser session has a unique session ID to simulate a separate phone number.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
