"use client";

import { useState } from 'react';
import {
  Video, Plus, Users, ArrowRight, Clock, Crown,
  Settings, LogOut, Shield, Calendar,
  Copy, Check, Zap, Languages, Loader2,
  Brain, FileText, Mic, Monitor, Lock, AlertTriangle, RotateCcw, X
} from 'lucide-react';
import type { AppView, PlanTier, Subscription, PlanLimits } from '../types';
import type { UserProfile } from '../hooks/useAuth';
import type { StoredMeeting, ActiveSession } from '../lib/persist';
import { useClipboard } from '../hooks/useClipboard';
import Logo from './Logo';

interface DashboardProps {
  setView: (v: AppView) => void;
  roomId: string;
  setRoomId: (id: string) => void;
  userName: string;
  setUserName: (name: string) => void;
  profile: UserProfile;
  subscription: Subscription;
  planLimits: PlanLimits;
  isOfflineMode: boolean;
  onSignOut: () => void;
  onUpdateName: (name: string) => Promise<{ success: boolean }>;
  // Meeting history + reconnect + limits
  meetingHistory: StoredMeeting[];
  pendingReconnect: ActiveSession | null;
  onReconnect: (password?: string) => void;
  onDismissReconnect: () => void;
  meetingsThisMonth: number;
  meetingLimitReached: boolean;
  maxMeetingsPerMonth: number;
}

function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segs = [];
  for (let i = 0; i < 3; i++) {
    let s = '';
    for (let j = 0; j < 4; j++) s += chars[Math.floor(Math.random() * chars.length)];
    segs.push(s);
  }
  return segs.join('-');
}

const PLAN_COLORS: Record<PlanTier, string> = {
  trial: 'from-amber-500 to-orange-400',
  classroom: 'from-emerald-500 to-teal-400',
  classroom_plus: 'from-emerald-600 to-teal-500',
  individual: 'from-cyan-500 to-sky-400',
  pro: 'from-blue-500 to-cyan-400',
  business: 'from-purple-500 to-pink-500',
  enterprise: 'from-amber-500 to-orange-500',
  // Platinum / dark for the high-capacity tier
  unlimited: 'from-slate-300 via-zinc-400 to-slate-600',
};

const PLAN_NAMES: Record<PlanTier, string> = {
  trial: '14-Day Trial',
  classroom: 'Classroom (R89/mo)',
  classroom_plus: 'Classroom+ (R220/mo)',
  individual: 'Individual (R110/mo)',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
  unlimited: 'Unlimited (R389/mo)',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diff < 172800000) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function Dashboard({
  setView, setRoomId, userName, setUserName,
  profile, subscription, planLimits,
  onSignOut,
  meetingHistory, pendingReconnect, onReconnect, onDismissReconnect,
  meetingsThisMonth, meetingLimitReached, maxMeetingsPerMonth,
}: DashboardProps) {
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'home' | 'meetings' | 'settings'>('home');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const { copy } = useClipboard();

  const initials = profile.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const handleNewMeeting = (type: 'meeting' | 'classroom' = 'meeting') => {
    if (!userName) setUserName(profile.displayName);
    const code = generateRoomId();
    // Use URL search params approach if state reset occurs, but here we set internal state
    setRoomId(`${code}:${type}`);
    setView('lobby');
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    if (!userName) setUserName(profile.displayName);
    setRoomId(joinCode.trim());
    setView('lobby');
  };

  const handleRejoin = (code: string) => {
    if (!userName) setUserName(profile.displayName);
    setRoomId(code);
    setView('lobby');
  };

  const copyCode = (code: string) => {
    copy(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  return (
    <div className="h-screen h-[100dvh] flex">
      {/* ─── SIDEBAR ─── */}
      <aside className="w-64 glass border-r border-slate-800/50 flex flex-col shrink-0 hidden lg:flex">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800/30">
          <Logo size="md" />
        </div>

        {/* New meeting button */}
        <div className="px-4 py-4">
          <button
            onClick={() => handleNewMeeting('meeting')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg glow-blue text-sm"
          >
            <Plus className="w-4 h-4" />
            New Meeting
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {[
            { id: 'home' as const, icon: Video, label: 'Home' },
            { id: 'meetings' as const, icon: Calendar, label: 'Meetings' },
            { id: 'settings' as const, icon: Settings, label: 'Settings' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setSidebarTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                sidebarTab === item.id
                  ? 'bg-blue-500/15 text-blue-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </button>
          ))}

          <div className="pt-2">
            <button
              onClick={() => setView('pricing')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all"
            >
              <Crown className="w-4.5 h-4.5" />
              Plans & Billing
            </button>
          </div>
        </nav>

        {/* User card */}
        <div className="px-4 py-4 border-t border-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-sm font-bold shadow-md shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{profile.displayName}</div>
              <div className="text-[10px] text-slate-500 truncate">{profile.email}</div>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden glass sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('pricing')} className="p-2 rounded-lg text-slate-400 hover:text-white"><Crown className="w-4 h-4" /></button>
            <button onClick={onSignOut} className="p-2 rounded-lg text-slate-400 hover:text-red-400"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          {/* ─── WELCOME HEADER ─── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {profile.displayName.split(' ')[0]} 👋</h1>
              <p className="text-slate-400 mt-1">Start a meeting or join one below.</p>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${PLAN_COLORS[subscription.tier]} bg-opacity-10 text-sm font-medium`}
              style={{ background: `linear-gradient(135deg, rgba(59,130,246,0.1), rgba(6,182,212,0.1))` }}>
              <Crown className="w-4 h-4" />
              {PLAN_NAMES[subscription.tier]} Plan
              {subscription.tier === 'trial' && (
                <button
                  onClick={async () => {
                    setUpgradeLoading(true);
                    try {
                      const { createProCheckout } = await import('../app/actions/checkout-actions');
                      const result = await createProCheckout();
                      if (result.url) {
                        window.location.href = result.url;
                      } else if (result.error) {
                        alert(result.error);
                      }
                    } catch {
                      setView('pricing');
                    } finally {
                      setUpgradeLoading(false);
                    }
                  }}
                  disabled={upgradeLoading}
                  className="text-blue-400 hover:text-blue-300 ml-1 text-xs underline disabled:opacity-50"
                >
                  {upgradeLoading ? 'Loading…' : 'Upgrade'}
                </button>
              )}
            </div>
          </div>

          {/* ─── QUICK ACTIONS ─── */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Business Meeting */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Business Meeting</h2>
                  <p className="text-xs text-slate-500">Professional sync</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">Collaborative tools, AI summaries, and professional layout. Up to {planLimits.maxParticipants} participants.</p>
              <button
                onClick={() => handleNewMeeting('meeting')}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg glow-blue"
              >
                <Video className="w-4 h-4" />
                Start Business Meeting
              </button>
            </div>

            {/* Education Room */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Education Room</h2>
                  <p className="text-xs text-slate-500">Interactive learning</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">Whiteboard, tutor controls, and 5-learner cap. Perfect for high-end education ($89/mo).</p>
              <button
                onClick={async () => {
                  if (subscription.tier !== 'classroom') {
                    // Unpaid user — redirect to Lemon Squeezy checkout (R89/mo ZAR)
                    setUpgradeLoading(true);
                    try {
                      const { createClassroomCheckout } = await import('../app/actions/checkout-actions');
                      const result = await createClassroomCheckout();
                      if (result.url) {
                        window.location.href = result.url;
                      } else if (result.error) {
                        alert(result.error);
                      }
                    } catch {
                      setView('pricing');
                    } finally {
                      setUpgradeLoading(false);
                    }
                  } else {
                    // Already subscribed — launch the room directly
                    handleNewMeeting('classroom');
                  }
                }}
                disabled={upgradeLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-emerald-500 hover:to-teal-400 transition-all shadow-lg glow-emerald disabled:opacity-50"
              >
                {upgradeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {upgradeLoading ? 'Redirecting to checkout…' : 'Launch Classroom'}
              </button>
            </div>

            {/* Join Meeting */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Join Meeting</h2>
                  <p className="text-xs text-slate-500">Enter a meeting code</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="xxxx-xxxx-xxxx"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono text-sm"
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={!joinCode.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-purple-500 hover:to-pink-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
              >
                Join Meeting
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Education Room — Classroom+ (R220/mo, 30 learners) */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    Classroom Plus
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">PLUS</span>
                  </h2>
                  <p className="text-xs text-slate-500">High-capacity learning</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">Whiteboard, tutor controls, and a 30-learner cap. For larger classes and bootcamps (R220/mo).</p>
              <button
                onClick={async () => {
                  if (subscription.tier !== 'classroom_plus') {
                    setUpgradeLoading(true);
                    try {
                      const { createClassroomPlusCheckout } = await import('../app/actions/checkout-actions');
                      const result = await createClassroomPlusCheckout();
                      if (result.url) {
                        window.location.href = result.url;
                      } else if (result.error) {
                        alert(result.error);
                      }
                    } catch {
                      setView('pricing');
                    } finally {
                      setUpgradeLoading(false);
                    }
                  } else {
                    handleNewMeeting('classroom');
                  }
                }}
                disabled={upgradeLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-emerald-500 hover:to-teal-400 transition-all shadow-lg glow-emerald disabled:opacity-50"
              >
                {upgradeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {upgradeLoading ? 'Redirecting to checkout…' : 'Launch Classroom Plus — R220/mo'}
              </button>
            </div>

            {/* Conferly Unlimited — R389/mo, no cap (Platinum / dark style) */}
            <div className="glass rounded-2xl p-6 space-y-4 relative overflow-hidden">
              {/* Subtle platinum sheen */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700/20 via-zinc-800/20 to-slate-900/20 pointer-events-none" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-300 via-zinc-400 to-slate-600 flex items-center justify-center shadow-lg ring-1 ring-white/20">
                    <Crown className="w-6 h-6 text-slate-900" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      Conferly Unlimited
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-slate-300 to-zinc-400 text-slate-900">PLATINUM</span>
                    </h2>
                    <p className="text-xs text-slate-400">No limits. No boundaries.</p>
                  </div>
                </div>
                <p className="text-sm text-slate-300">
                  Conferly Unlimited: No limits, no boundaries. Host unlimited participants for R389/month.
                </p>
                <button
                  onClick={async () => {
                    if (subscription.tier !== 'unlimited') {
                      setUpgradeLoading(true);
                      try {
                        const { createUnlimitedCheckout } = await import('../app/actions/checkout-actions');
                        const result = await createUnlimitedCheckout();
                        if (result.url) {
                          window.location.href = result.url;
                        } else if (result.error) {
                          alert(result.error);
                        }
                      } catch {
                        setView('pricing');
                      } finally {
                        setUpgradeLoading(false);
                      }
                    } else {
                      handleNewMeeting('meeting');
                    }
                  }}
                  disabled={upgradeLoading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-slate-700 via-zinc-800 to-slate-900 text-white font-semibold flex items-center justify-center gap-2 hover:from-slate-600 hover:via-zinc-700 hover:to-slate-800 transition-all shadow-xl ring-1 ring-white/10 disabled:opacity-50"
                >
                  {upgradeLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Crown className="w-4 h-4" />
                  )}
                  {upgradeLoading ? 'Redirecting to checkout…' : 'Go Unlimited — R389/mo'}
                </button>
              </div>
            </div>
          </div>

          {/* ─── RECONNECT PROMPT ─── */}
          {pendingReconnect && (
            <div className="glass rounded-2xl p-5 border border-amber-500/20 bg-amber-500/[0.03] space-y-3">
              <div className="flex items-center gap-3">
                <RotateCcw className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-300">Reconnect to meeting?</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Room: <code className="text-slate-300 font-mono">{pendingReconnect.roomCode}</code> • Duration: {formatDuration(pendingReconnect.durationAtPause)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onReconnect()} className="flex-1 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 font-semibold text-sm active:bg-amber-500/30 transition-colors flex items-center justify-center gap-2 min-h-[44px]">
                  <RotateCcw className="w-4 h-4" /> Reconnect
                </button>
                <button onClick={onDismissReconnect} className="p-2.5 rounded-xl bg-slate-800/40 text-slate-500 active:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── MEETING LIMIT WARNING ─── */}
          {meetingLimitReached && (
            <div className="glass rounded-2xl p-5 border border-red-500/20 bg-red-500/[0.03] space-y-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-300">You've reached your trial meeting limit</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{meetingsThisMonth}/{maxMeetingsPerMonth} meetings used this month. Upgrade to Pro for unlimited meetings.</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setUpgradeLoading(true);
                  try {
                    const { createProCheckout } = await import('../app/actions/checkout-actions');
                    const result = await createProCheckout();
                    if (result.url) {
                      window.location.href = result.url;
                    } else if (result.error) {
                      alert(result.error);
                    }
                  } catch {
                    setView('pricing');
                  } finally {
                    setUpgradeLoading(false);
                  }
                }}
                disabled={upgradeLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-sm min-h-[44px] disabled:opacity-50"
              >
                {upgradeLoading ? 'Loading…' : 'Upgrade to Pro — Unlimited Meetings'}
              </button>
            </div>
          )}

          {/* ─── RECENT MEETINGS ─── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent Meetings</h2>
              {!meetingLimitReached && maxMeetingsPerMonth !== -1 && (
                <span className="text-xs text-slate-500">{meetingsThisMonth}/{maxMeetingsPerMonth} this month</span>
              )}
            </div>
            {meetingHistory.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center space-y-2">
                <Video className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-500">No meetings yet</p>
                <p className="text-xs text-slate-500">Create your first meeting to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetingHistory.slice(0, 10).map(m => (
                  <div key={m.id} className="glass rounded-xl p-4 flex items-center gap-4 hover:border-slate-600/40 transition-all group">
                    <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors">
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.title}</div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(m.startedAt)}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.participantCount}</span>
                        <span>{formatDuration(m.duration)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => copyCode(m.roomCode)} className="p-2 rounded-lg bg-slate-800/40 text-slate-500 hover:text-white transition-colors" title="Copy code">
                        {copiedCode === m.roomCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handleRejoin(m.roomCode)} className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors min-h-[40px]">
                        Rejoin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── FEATURES OVERVIEW ─── */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Your Tools</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Mic, label: 'Transcription', desc: 'Live speech-to-text', available: planLimits.transcription, color: 'text-green-400' },
                { icon: Languages, label: 'Translation', desc: '11 SA languages', available: true, color: 'text-cyan-400' },
                { icon: Brain, label: 'AI Pulse', desc: 'Meeting summaries', available: planLimits.aiPulse, color: 'text-pink-400' },
                { icon: FileText, label: 'Collab Notes', desc: 'Real-time editing', available: true, color: 'text-purple-400' },
                { icon: Monitor, label: 'Screen Share', desc: 'Share anything', available: true, color: 'text-amber-400' },
                { icon: Video, label: 'Recording', desc: 'Save meetings', available: planLimits.recording, color: 'text-blue-400' },
                { icon: Shield, label: 'Security', desc: 'Password & lock', available: planLimits.meetingPassword, color: 'text-emerald-400' },
                { icon: Lock, label: 'Waiting Room', desc: 'Approve joiners', available: planLimits.waitingRoom, color: 'text-rose-400' },
              ].map(tool => (
                <div key={tool.label} className={`glass rounded-xl p-4 space-y-2 ${!tool.available ? 'opacity-50' : 'hover:border-slate-600/40'} transition-all`}>
                  <tool.icon className={`w-5 h-5 ${tool.color}`} />
                  <div className="text-sm font-medium">{tool.label}</div>
                  <div className="text-[10px] text-slate-500">{tool.desc}</div>
                  {!tool.available && (
                    <button onClick={() => setView('pricing')} className="text-[10px] text-amber-400 flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" /> Upgrade
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ─── PLAN UPSELL ─── */}
          {subscription.tier === 'trial' && (
            <div className="glass rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-bold">Unlock all features</h3>
                </div>
                <p className="text-sm text-slate-400">Upgrade to Pro for recording, AI summaries, waiting room, and 8-hour meetings — starting at $9/user/month.</p>
              </div>
              <button
                onClick={() => setView('pricing')}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold whitespace-nowrap hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg glow-blue flex items-center gap-2"
              >
                View Plans
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ─── KEYBOARD SHORTCUTS ─── */}
          <div className="glass rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Keyboard Shortcuts (in meeting)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { key: 'M', action: 'Toggle mute' },
                { key: 'V', action: 'Toggle camera' },
                { key: 'H', action: 'Raise hand' },
                { key: 'Esc', action: 'Close sidebar' },
              ].map(s => (
                <div key={s.key} className="flex items-center gap-2 text-slate-400">
                  <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700/50">{s.key}</kbd>
                  {s.action}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
