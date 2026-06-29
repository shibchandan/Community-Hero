import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';

interface CivicBotProps {
  theme: 'dark' | 'light';
}

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
}

const SUGGESTED_QUESTIONS = [
  "How do I report a pothole?",
  "What is the SLA for broken streetlights?",
  "How can I earn Civic Badges?"
];

export function CivicBot({ theme }: CivicBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'bot', text: 'Hi! I am CivicBot, your AI Assistant. How can I help you improve our city today?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text
    };

    const currentHistory = [...messages, userMessage];

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: currentHistory.map(m => ({ sender: m.sender, text: m.text }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: data.reply
        }]);
      } else {
        throw new Error('API response not ok');
      }
    } catch (err) {
      console.error('Failed to communicate with CivicBot API, running local fallback:', err);
      // Simulate AI response delay for consistency in fallback
      let botReply = "I've recorded your query. Is there anything else you need help with?";
      
      const lowerText = text.toLowerCase();
      if (lowerText.includes('report')) {
        botReply = "To report an issue, use the 'Report Hazard' tab. Provide a clear picture and location, and our AI will automatically classify the severity and route it to the correct department.";
      } else if (lowerText.includes('sla') || lowerText.includes('time')) {
        botReply = "Service Level Agreements (SLAs) vary: 2 days for Safety Hazards, 3 for Garbage, 5 for Streetlights, and 7 for Roads.";
      } else if (lowerText.includes('badge') || lowerText.includes('points')) {
        botReply = "You earn 40 points for reporting and 10 points for validating issues. Accumulate points to rank up and unlock exclusive Civic Badges!";
      } else if (lowerText.includes('hello') || lowerText.includes('hi')) {
        botReply = "Hello! Ready to make our community better?";
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: botReply
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center justify-center cursor-pointer ${
          theme === 'dark'
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-500/20'
            : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-indigo-500/30'
        } ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <MessageSquare className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white border-2 border-white dark:border-slate-900">
          1
        </span>
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`fixed bottom-6 right-6 z-50 w-[350px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] rounded-2xl shadow-2xl flex flex-col border overflow-hidden ${
              theme === 'dark' ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'
            }`}
          >
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b ${
              theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-indigo-600 text-white border-indigo-700'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center relative">
                  <Bot className={`w-5 h-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-white'}`} />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-white'}`}>CivicBot</h3>
                  <p className={`text-[10px] ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-200'}`}>AI Assistant • Online</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-white/20 text-white'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className={`flex-1 p-4 overflow-y-auto flex flex-col gap-4 ${
              theme === 'dark' ? 'bg-slate-950/50' : 'bg-slate-50'
            }`}>
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                  <div className={`w-6 h-6 rounded-full flex shrink-0 items-center justify-center mt-1 ${
                    msg.sender === 'user'
                      ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600')
                      : (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600')
                  }`}>
                    {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : theme === 'dark'
                        ? 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50'
                        : 'bg-white text-slate-700 rounded-tl-sm border border-slate-100'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex gap-2 max-w-[85%] self-start">
                  <div className={`w-6 h-6 rounded-full flex shrink-0 items-center justify-center mt-1 ${
                    theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className={`p-3.5 rounded-2xl rounded-tl-sm shadow-sm flex gap-1 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700/50' : 'bg-white border-slate-100'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={`p-3 border-t ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              {/* Quick Suggestion Pills */}
              {messages.length < 3 && (
                <div className="flex overflow-x-auto gap-2 mb-3 pb-1 no-scrollbar">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className={`shrink-0 text-[10px] px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                        theme === 'dark' 
                          ? 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10' 
                          : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask CivicBot..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend(inputText)}
                  className={`w-full pl-4 pr-12 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-950/50 text-white placeholder-slate-500 border border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20'
                      : 'bg-slate-100 text-slate-900 placeholder-slate-500 border border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
                <button
                  onClick={() => handleSend(inputText)}
                  disabled={!inputText.trim()}
                  className={`absolute right-1.5 top-1.5 p-1.5 rounded-lg transition-colors cursor-pointer ${
                    inputText.trim() 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm' 
                      : theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
