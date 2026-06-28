/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import {
  Map, FileText, Sparkles, Shield, Trophy, BarChart3,
  UserCheck, ChevronLeft, ChevronRight, Layers, LogOut,
  LogIn, Sun, Moon, RefreshCw, X, TrendingUp, Link2, MessageCircle
} from 'lucide-react';
import { User } from '../types';
import { NotificationBell } from './NotificationDrawer';
import { Issue } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'map' | 'feed' | 'report' | 'authority' | 'leaderboard' | 'dashboard' | 'profile' | 'analytics' | 'ledger' | 'whatsapp' | 'docs';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  currentUser: User | null;
  issues: Issue[];
  loading: boolean;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  onLogin: () => void;
  onLogout: () => void;
  onToggleRole: () => void;
  onSelectIssue: (issueId: string) => void;
}

// ── Nav Items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'map'        as TabId, label: 'Explore Radar',    icon: Map,            group: 'main' },
  { id: 'feed'       as TabId, label: 'Civic Feed',        icon: FileText,       group: 'main' },
  { id: 'report'     as TabId, label: 'Report Hazard',     icon: Sparkles,       group: 'main' },
  { id: 'authority'  as TabId, label: 'SLA Dispatch',      icon: Shield,         group: 'tools' },
  { id: 'leaderboard'as TabId, label: 'Hero Center',       icon: Trophy,         group: 'tools' },
  { id: 'dashboard'  as TabId, label: 'SLA Dashboard',     icon: BarChart3,      group: 'tools' },
  { id: 'analytics'  as TabId, label: 'Admin Analytics',   icon: TrendingUp,     group: 'tools' },
  { id: 'ledger'     as TabId, label: 'Proof Ledger',       icon: Link2,          group: 'advanced' },
  { id: 'whatsapp'   as TabId, label: 'WhatsApp Bot',       icon: MessageCircle,  group: 'advanced' },
  { id: 'docs'       as TabId, label: 'Google Docs Hub',   icon: FileText,       group: 'advanced' },
];

// ── NavButton ─────────────────────────────────────────────────────────────────

function NavButton({
  item, active, expanded, theme, onClick
}: {
  key?: any;
  item: typeof NAV_ITEMS[0];
  active: boolean;
  expanded: boolean;
  theme: 'dark' | 'light';
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      title={!expanded ? item.label : undefined}
      onClick={onClick}
      className={`relative w-full flex items-center gap-3 py-2 rounded-xl transition-all duration-200 cursor-pointer group overflow-hidden ${
        expanded ? 'px-3' : 'px-0 justify-center'
      } ${
        active
          ? 'text-white'
          : theme === 'dark'
            ? 'text-slate-400 hover:text-white hover:bg-white/8'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {/* Active background pill */}
      {active && (
        <motion.div
          layoutId="sidebar-active-pill"
          className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 rounded-xl shadow-lg shadow-indigo-500/25"
          initial={false}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}

      {/* Icon */}
      <item.icon
        className={`relative z-10 shrink-0 w-5 h-5 transition-transform duration-200 ${
          !active ? 'group-hover:scale-110' : ''
        }`}
      />

      {/* Label — only when expanded */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 text-xs font-bold whitespace-nowrap overflow-hidden"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({
  activeTab, setActiveTab, theme, setTheme,
  currentUser, issues, loading, expanded, setExpanded,
  onLogin, onLogout, onToggleRole, onSelectIssue
}: SidebarProps) {

  const mainItems = NAV_ITEMS.filter(n => n.group === 'main');
  const toolItems = NAV_ITEMS.filter(n => n.group === 'tools');
  const advancedItems = NAV_ITEMS.filter(n => n.group === 'advanced');

  // Avatar initials
  const initials = currentUser
    ? currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const sidebarW = expanded ? 220 : 64;

  return (
    <motion.aside
      animate={{ width: sidebarW }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className={`fixed top-0 left-0 h-full z-30 flex flex-col py-5 border-r overflow-visible ${
        theme === 'dark'
          ? 'bg-slate-950/95 border-white/10 text-white'
          : 'bg-white border-slate-200 text-slate-900'
      } shadow-2xl`}
    >
      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-3.5 mb-6 ${!expanded ? 'justify-center' : ''}`}>
        <div className="relative shrink-0 group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-xl blur-md opacity-40 group-hover:opacity-80 transition duration-500" />
          <div className="relative w-9 h-9 bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-inner border border-white/20">
            <Sparkles className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          </div>
        </div>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <p className={`text-sm font-black font-display leading-tight whitespace-nowrap ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>Samadhan Setu</p>
              <p className={`text-[9px] font-bold uppercase tracking-widest whitespace-nowrap ${
                theme === 'dark' ? 'text-cyan-400' : 'text-indigo-500'
              }`}>Civic Engine</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main Nav ───────────────────────────────────────────────── */}
      <nav role="tablist" aria-label="Sidebar Navigation" className="flex flex-col gap-2 px-2 flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full pr-1">
        {mainItems.map(item => (
          <NavButton
            key={item.id}
            item={item}
            active={activeTab === item.id}
            expanded={expanded}
            theme={theme}
            onClick={() => setActiveTab(item.id)}
          />
        ))}

        {/* Divider */}
        <div className={`h-px mx-2 my-0.5 opacity-60 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />

        {toolItems.map(item => (
          <NavButton
            key={item.id}
            item={item}
            active={activeTab === item.id}
            expanded={expanded}
            theme={theme}
            onClick={() => setActiveTab(item.id)}
          />
        ))}

        {/* Divider */}
        <div className={`h-px mx-2 my-0.5 opacity-60 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />

        {advancedItems.map(item => (
          <NavButton
            key={item.id}
            item={item}
            active={activeTab === item.id}
            expanded={expanded}
            theme={theme}
            onClick={() => setActiveTab(item.id)}
          />
        ))}

        {/* Profile — only when logged in */}
        {currentUser && (
          <>
            {/* Divider */}
            <div className={`h-px mx-2 my-0.5 opacity-60 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
            <NavButton
              item={{ id: 'profile', label: 'My Profile', icon: UserCheck, group: 'account' }}
              active={activeTab === 'profile'}
              expanded={expanded}
              theme={theme}
              onClick={() => setActiveTab('profile')}
            />
          </>
        )}
      </nav>

      {/* ── Bottom Controls ────────────────────────────────────────── */}
      <div className={`flex flex-col gap-2 px-2 mt-3 pt-3 border-t ${
        theme === 'dark' ? 'border-white/10' : 'border-slate-200'
      }`}>

        {/* Notifications */}
        <NotificationBell
          issues={issues}
          currentUser={currentUser}
          theme={theme}
          onSelectIssue={onSelectIssue}
          expanded={expanded}
        />

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          className={`w-full flex items-center gap-3 py-2 rounded-xl cursor-pointer transition-all duration-200 group overflow-hidden ${
            expanded ? 'px-3' : 'px-0 justify-center'
          } ${
            theme === 'dark'
              ? 'text-slate-400 hover:text-white hover:bg-white/8'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          {theme === 'dark'
            ? <Sun className="w-5 h-5 shrink-0 group-hover:rotate-45 transition-transform" />
            : <Moon className="w-5 h-5 shrink-0" />
          }
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="text-xs font-bold whitespace-nowrap overflow-hidden"
              >
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User / Login */}
        {currentUser ? (
          <>
            {/* User avatar + name */}
            <div className={`w-full flex items-center gap-3 py-2 rounded-xl overflow-hidden ${
              expanded ? 'px-3' : 'px-0 justify-center'
            } ${
              theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'
            }`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                {initials}
              </div>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden min-w-0"
                  >
                    <p className={`text-xs font-bold truncate max-w-[120px] ${
                      theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                    }`}>{currentUser.name}</p>
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${
                      theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                    }`}>{currentUser.role}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Toggle Role */}
            <button
              onClick={onToggleRole}
              title="Toggle Role"
              className={`w-full flex items-center gap-3 py-2 rounded-xl cursor-pointer transition-all duration-200 group overflow-hidden ${
                expanded ? 'px-3' : 'px-0 justify-center'
              } ${
                theme === 'dark'
                  ? 'text-indigo-400 hover:text-white hover:bg-indigo-500/15'
                  : 'text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Layers className="w-5 h-5 shrink-0" />
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs font-bold whitespace-nowrap overflow-hidden"
                  >
                    Toggle Identity
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              title="Sign Out"
              className={`w-full flex items-center gap-3 py-2 rounded-xl cursor-pointer transition-all duration-200 group overflow-hidden ${
                expanded ? 'px-3' : 'px-0 justify-center'
              } ${
                theme === 'dark'
                  ? 'text-rose-400 hover:text-white hover:bg-rose-500/15'
                  : 'text-rose-500 hover:bg-rose-50'
              }`}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs font-bold whitespace-nowrap overflow-hidden"
                  >
                    Sign Out
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </>
        ) : (
          <button
            onClick={onLogin}
            title="Sign In"
            className={`w-full flex items-center gap-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-all duration-200 group overflow-hidden text-xs font-bold shadow-lg shadow-indigo-500/20 ${
              expanded ? 'px-3' : 'px-0 justify-center'
            }`}
          >
            <LogIn className="w-5 h-5 shrink-0" />
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  Sign In
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
      </div>

      {/* ── Collapse Toggle ────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        className={`absolute -right-3 top-20 w-6 h-6 rounded-full border shadow-lg flex items-center justify-center cursor-pointer z-50 transition-all hover:scale-110 ${
          theme === 'dark'
            ? 'bg-slate-800 border-white/20 text-slate-300 hover:text-white hover:bg-slate-700'
            : 'bg-white border-slate-300 text-slate-500 hover:text-slate-900 shadow-md'
        }`}
      >
        {expanded
          ? <ChevronLeft className="w-3.5 h-3.5" />
          : <ChevronRight className="w-3.5 h-3.5" />
        }
      </button>
    </motion.aside>
  );
}
