"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, Shield, Video, ArrowRight,
  Mic, Monitor, Brain, FileText, Languages,
  CheckCircle2, Play, Building2, Star,
  Heart, MessageSquare, ArrowDown, Globe, Cpu,
  BookOpen, Users, GraduationCap
} from 'lucide-react';
import type { UserProfile } from '../hooks/useAuth';
import { useScrollToId } from '../hooks/useScrollToId';
import ProfileMenu from './ProfileMenu';
import Logo from './Logo';
import { getSession, getSupabaseClientInstance } from '../lib/supabaseClient';

import { signOut } from '../lib/clientAuth';
import { MEET_PLANS } from '../lib/pricing/meet';
import { CLASS_PLANS } from '../lib/pricing/class';

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateRoomId() {
  const c = 'abcdefghijklmnopqrstuvwxyz';
  const s: string[] = [];
  for (let i = 0; i < 3; i++) {
    let x = '';
    for (let j = 0; j < 4; j++) x += c[Math.floor(Math.random() * c.length)];
    s.push(x);
  }
  return s.join('-');
}

// Animated counter using IntersectionObserver
function Counter({ target, suffix = '' }: { target: string; suffix?: string }) {
  const [val, setVal] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVal(target);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return (
    <span ref={ref} className="tabular-nums">
      {val}
      {suffix}
    </span>
  );
}

// ─── Static data ────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: 'Thandi Mokoena',
    role: 'Teacher, Johannesburg',
    text: 'My Zulu-speaking parents can finally join school meetings. The live translation changes everything for inclusive education.',
    avatar: 'TM',
    rating: 5,
  },
  {
    name: 'Pieter van der Merwe',
    role: 'CEO, Cape Town',
    text: 'We saved R12,000/month switching from Zoom. The AI summaries alone pay for themselves — our team reclaims 8 hours a week.',
    avatar: 'PV',
    rating: 5,
  },
  {
    name: 'Naledi Khumalo',
    role: 'HR Director, Durban',
    text: 'Onboarding 40 people took 5 minutes. No downloads, no IT tickets, no confused employees. Just works.',
    avatar: 'NK',
    rating: 5,
  },
  {
    name: 'Sipho Ndlovu',
    role: 'Consultant, Pretoria',
    text: "I run client calls from my phone. The recording saves to my device, the transcription is instant. Best video tool I've ever used.",
    avatar: 'SN',
    rating: 5,
  },
];

const meetProPlan = MEET_PLANS.find(p => p.id === 'meet_pro');
const classRoomPlan = CLASS_PLANS.find(p => p.id === 'class_room');

// ─── Component ───────────────────────────────────────────────────────────────

export default function LandingPageClient() {
  const router = useRouter();
  const scrollToId = useScrollToId();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const isLoggedIn = !!profile;

  // Fetch session client-side — keeps SSR free of auth concerns and avoids
  // hydration mismatches.
  useEffect(() => {
    getSession()
      .then((session) => {
        if (session?.user) {
          const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
          setProfile({
            displayName:
              (meta.display_name as string) ||
              (meta.full_name as string) ||
              session.user.email?.split('@')[0] ||
              'User',
            email: session.user.email ?? '',
            createdAt: session.user.created_at,
            avatarUrl: (meta.avatar_url as string) || undefined,
          });
        }
      })
      .catch(() => {
        // Not signed in or network error — stay in logged-out state.
      })
      .finally(() => setSessionLoading(false));
  }, []);


  // Update display name directly via Supabase client
  const handleUpdateName = useCallback(
    async (name: string): Promise<{ success: boolean }> => {
      try {
        const supabase = await getSupabaseClientInstance();
        const { error } = await supabase.auth.updateUser({
          data: { display_name: name },
        });
        if (error) return { success: false };
        setProfile(prev => (prev ? { ...prev, displayName: name } : prev));
        return { success: true };
      } catch {
        return { success: false };
      }
    },
    [],
  );

  // Primary CTA — start meeting when logged in, else go to auth
  const quickStart = useCallback(() => {
    if (!isLoggedIn) {
      router.push('/auth');
      return;
    }
    router.push(`/lobby?room=${generateRoomId()}`);
  }, [isLoggedIn, router]);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">

      {/* ═══ NAV ═══ */}
      <nav className="glass sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between">
          <Logo size="md" />

          <div className="hidden lg:flex items-center gap-8 text-[13px] text-slate-400 font-medium">
            <a href="#features" className="hover:text-white transition-colors duration-200">Features</a>
            <a href="#languages" className="hover:text-white transition-colors duration-200">Languages</a>
            <button
              onClick={() => router.push('/pricing')}
              className="hover:text-white transition-colors duration-200"
            >
              Pricing
            </button>
            <a href="/class" className="text-emerald-400 hover:text-emerald-300 transition-colors duration-200">
              Conferly Class →
            </a>
          </div>

          {/* Auth area — hidden during initial session check to avoid layout shift */}
          <div className="flex items-center gap-3 min-h-[40px]">
            {!sessionLoading && (
              isLoggedIn ? (
                <ProfileMenu
                  profile={profile!}
                  isOfflineMode={false}
                  onSignOut={signOut}
                  onUpdateName={handleUpdateName}
                />
              ) : (
                <>
                  <button
                    onClick={() => router.push('/auth')}
                    className="hidden sm:block text-[13px] text-slate-400 hover:text-white font-medium transition-colors"
                  >
                    Log in
                  </button>
                  <button
                    onClick={() => router.push('/auth')}
                    className="px-5 py-2 rounded-full bg-white text-slate-900 text-[13px] font-semibold hover:bg-slate-100 transition-colors shadow-lg shadow-white/10"
                  >
                    Start Trial
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative px-5 sm:px-8 pt-20 sm:pt-28 pb-16 sm:pb-24">
        {/* Ambient glow orbs */}
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />
          <div className="absolute top-40 left-1/2 w-64 h-64 bg-purple-600/8 rounded-full blur-[80px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16 sm:mb-20">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-[13px] text-amber-300 mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Built on a philosophy of unity and trust
            </div>

            <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-[1.08] tracking-[-0.03em] mb-6">
              Connecting
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                with purpose.
              </span>
              <br />
              Built for meaningful connection.
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
              A premium conferencing platform rooted in the African philosophy of unity and trust.
              <span className="text-white font-medium"> Secure, inclusive, scalable — for every meaningful conversation.</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button
                onClick={quickStart}
                className="group px-8 py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-[15px] flex items-center gap-2.5 shadow-2xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] transition-all duration-300"
              >
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {isLoggedIn ? 'Start a Meeting' : 'Start 14-Day Trial'}
              </button>
              <button
                onClick={() => scrollToId('features')}
                className="px-8 py-4 rounded-full border border-white/10 text-slate-300 font-medium text-[15px] hover:bg-white/5 hover:border-white/20 transition-all duration-300 flex items-center gap-2"
              >
                See how it works
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-green-400/70" />
                End-to-end encrypted
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400/70" />
                11 SA languages
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400/70" />
                Sub-100ms latency
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400/70" />
                No install required
              </span>
            </div>
          </div>

          {/* Product mockup */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800/80 border-b border-white/5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-3 text-[11px] text-slate-500 font-mono">conferly.site — Meeting Room</span>
              </div>
              { }
              <img
                src="/images/app-mockup.png"
                alt="Conferly meeting interface"
                className="w-full"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LOGOS ═══ */}
      <section className="px-8 py-10 border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[11px] text-slate-500 uppercase tracking-[0.2em] mb-6">
            Trusted by forward-thinking teams
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {['StartupHub SA', 'EduConnect', 'AfriFinance', 'HealthBridge', 'GovConnect', 'TechLaunch'].map(name => (
              <span
                key={name}
                className="text-slate-500 font-semibold text-sm tracking-wide hover:text-slate-400 transition-colors cursor-default"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TWO PRODUCTS ═══ */}
      <section className="px-5 sm:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <p className="text-[13px] text-blue-400 font-semibold uppercase tracking-widest mb-4">Two products, one platform</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Choose the right tool
            <br />
            <span className="text-slate-500">for every conversation.</span>
          </h2>
        </div>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Conferly Meet Card */}
          <div className="group relative rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-500/5 to-blue-600/2 p-8 space-y-5 hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Conferly Meet</h3>
              <p className="text-sm text-slate-400 mt-1">Professional video meetings for teams and clients</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-white">R{meetProPlan ? meetProPlan.monthlyPrice : 169}</span>
              <span className="text-sm text-slate-500">/user/mo</span>
            </div>
            <button
              onClick={() => router.push('/meet/dashboard')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-sm transition-all duration-300 hover:opacity-90 shadow-lg"
            >
              Start Meeting
            </button>
          </div>

          {/* Conferly Class Card */}
          <div className="group relative rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 to-emerald-600/2 p-8 space-y-5 hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Conferly Class</h3>
              <p className="text-sm text-slate-400 mt-1">Virtual classrooms for tutors and training businesses</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-white">R{classRoomPlan ? classRoomPlan.monthlyPrice : 89}</span>
              <span className="text-sm text-slate-500">/mo</span>
            </div>
            <button
              onClick={() => router.push('/class/dashboard')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold text-sm transition-all duration-300 hover:opacity-90 shadow-lg"
            >
              Create Classroom
            </button>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="px-8 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '<100', suffix: 'ms', label: 'Latency',    sub: 'Real-time WebRTC' },
            { value: '11',   suffix: '',   label: 'Languages',  sub: 'SA official languages' },
            { value: '',     suffix: '',   label: 'Browser-native',  sub: 'No installation required' },
            { value: '14',   suffix: 'day', label: 'Free trial', sub: 'No credit card' },
          ].map(s => (
            <div key={s.label} className="text-center group">
              <div className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                {s.value ? <Counter target={s.value} suffix={s.suffix} /> : <span className="text-3xl">✓</span>}
              </div>
              {s.value && <div className="text-sm font-semibold text-slate-300 mt-2">{s.label}</div>}
              {!s.value && <div className="text-sm font-semibold text-slate-300 mt-2">{s.label}</div>}
              <div className="text-[11px] text-slate-500 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="text-[13px] text-blue-400 font-semibold uppercase tracking-widest mb-4">Features</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Everything your team needs.
              <br />
              <span className="text-slate-500">Nothing it doesn't.</span>
            </h2>
            <p className="text-slate-400">Every feature runs in your browser. No plugins, no extensions, no IT tickets.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Video,        title: 'HD Video & Audio',      desc: 'WebRTC with echo cancellation, noise suppression, and auto gain.',              gradient: 'from-blue-500/10 to-blue-600/5',     accent: 'text-blue-400',    border: 'hover:border-blue-500/20' },
              { icon: Languages,    title: '11 SA Languages',        desc: 'Translate isiZulu, isiXhosa, Afrikaans, Sesotho, and 7 more — live.',           gradient: 'from-cyan-500/10 to-cyan-600/5',     accent: 'text-cyan-400',    border: 'hover:border-cyan-500/20' },
              { icon: Mic,          title: 'Live Transcription',     desc: 'Real-time speech-to-text with interim results. Every word captured.',           gradient: 'from-green-500/10 to-green-600/5',   accent: 'text-green-400',   border: 'hover:border-green-500/20' },
              { icon: Brain,        title: 'AI Meeting Pulse',       desc: 'Automatic 3-point summary of your meeting via TF-IDF analysis.',                gradient: 'from-pink-500/10 to-pink-600/5',     accent: 'text-pink-400',    border: 'hover:border-pink-500/20' },
              { icon: FileText,     title: 'Collaborative Notes',    desc: 'Rich text editor synced in real-time with Yjs CRDT conflict resolution.',       gradient: 'from-purple-500/10 to-purple-600/5', accent: 'text-purple-400',  border: 'hover:border-purple-500/20' },
              { icon: Monitor,      title: 'Screen Sharing',         desc: 'Share your screen, a window, or a browser tab with one click.',                 gradient: 'from-amber-500/10 to-amber-600/5',   accent: 'text-amber-400',   border: 'hover:border-amber-500/20' },
              { icon: Shield,       title: 'Meeting Security',       desc: 'Passwords, waiting room, meeting lock, and E2E encryption.',                    gradient: 'from-emerald-500/10 to-emerald-600/5', accent: 'text-emerald-400', border: 'hover:border-emerald-500/20' },
              { icon: MessageSquare, title: 'Chat & Reactions',       desc: 'In-meeting messaging, emoji reactions, and raise hand.',                        gradient: 'from-rose-500/10 to-rose-600/5',     accent: 'text-rose-400',    border: 'hover:border-rose-500/20' },
            ].map(f => (
              <div
                key={f.title}
                className={`group relative rounded-2xl border border-white/5 ${f.border} p-6 bg-gradient-to-b ${f.gradient} transition-all duration-300 hover:-translate-y-1`}
              >
                <div className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-4 ${f.accent} group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-[15px] mb-2">{f.title}</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SA LANGUAGE SHOWCASE ═══ */}
      <section id="languages" className="px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl border border-white/5 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 via-transparent to-purple-600/5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="grid lg:grid-cols-2 gap-0 relative z-10">
              <div className="p-8 sm:p-12 lg:p-16 space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-[12px] text-cyan-400 font-semibold">
                  <Languages className="w-3.5 h-3.5" />
                  First of its kind in Africa
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                  Speak your language.
                  <br />
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    We translate live.
                  </span>
                </h2>
                <p className="text-slate-400 leading-relaxed text-[15px] max-w-lg">
                  Conferly is the first premium conferencing platform with live translation for all 11 official
                  South African languages. Speak in isiZulu — everyone reads the English translation in real time.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['isiZulu', 'isiXhosa', 'Afrikaans', 'Sesotho', 'Setswana', 'Xitsonga', 'siSwati', 'Tshivenḓa', 'isiNdebele', 'Sepedi', 'English'].map(lang => (
                    <span
                      key={lang}
                      className="px-3 py-1.5 rounded-full border border-white/8 bg-white/3 text-[12px] text-slate-300"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-8 sm:p-12 lg:p-16 flex items-center">
                <div className="w-full space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                  <div className="text-[11px] text-slate-500 font-mono uppercase tracking-widest">
                    Live Translation
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-slate-800/30 border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/15 text-cyan-400">ZU</span>
                        <span className="text-[12px] text-blue-400 font-medium">Thandi</span>
                        <span className="text-[10px] text-slate-400 ml-auto">09:14:32</span>
                      </div>
                      <p className="text-sm text-slate-400">Sawubona, ngicela ukubona umhlangano wethu wanamuhla</p>
                    </div>
                    <div className="flex items-center gap-3 px-4">
                      <ArrowRight className="w-3.5 h-3.5 text-cyan-500/60" />
                      <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 to-transparent" />
                    </div>
                    <div className="p-4 rounded-xl bg-cyan-500/[0.03] border border-cyan-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-green-500/15 text-green-400">EN</span>
                        <span className="text-[12px] text-green-400 font-medium">Translated</span>
                      </div>
                      <p className="text-sm text-white font-medium">Hello, please may I see our meeting for today</p>
                    </div>
                  </div>
                    <p className="text-[10px] text-slate-500 text-center pt-1">
                    Remote AI translation • Zero local processing
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[13px] text-yellow-400 font-semibold uppercase tracking-widest mb-4">Testimonials</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Loved by teams across
              <br />
              <span className="bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">
                South Africa.
              </span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TESTIMONIALS.map(t => (
              <div
                key={t.name}
                className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-4 hover:border-white/10 transition-colors duration-300"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-[13px] text-slate-300 leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[11px] font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">{t.name}</div>
                    <div className="text-[11px] text-slate-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-blue-600/[0.06] to-transparent p-10 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="relative z-10 space-y-8">
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Elevate your team's
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  collaboration.
                </span>
              </h2>
              <p className="text-lg text-slate-400 max-w-xl mx-auto">
                No credit card. No downloads. No contracts. Your first meeting starts in 5 seconds.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={quickStart}
                  className="group px-10 py-4 rounded-full bg-white text-slate-900 font-semibold text-[15px] flex items-center gap-2.5 shadow-2xl shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] transition-all duration-300"
                >
                  <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  {isLoggedIn ? 'Start Meeting' : 'Start 14-Day Trial'}
                </button>
                <button
                  onClick={() => router.push('/pricing')}
                  className="px-10 py-4 rounded-full border border-white/10 text-slate-300 font-medium text-[15px] hover:bg-white/5 transition-all duration-300 flex items-center gap-2"
                >
                  <Building2 className="w-5 h-5" />
                  Business Plans
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-6 text-[12px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400/60" />
                  14-day free trial
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400/60" />
                  No credit card
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400/60" />
                  Cancel anytime
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="px-5 sm:px-8 py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-14">
            <div className="lg:col-span-2 space-y-4">
              <Logo size="sm" />
              <p className="text-[13px] text-slate-500 leading-relaxed max-w-xs">
                Lightning-fast video conferencing built for Africa. Open source. Privacy first. Made with purpose.
              </p>
              <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                Made with <Heart className="w-3 h-3 text-red-400/60 mx-1" /> in South Africa
              </div>
            </div>
            {[
              {
                title: 'Product',
                links: [
                  { label: 'Features', href: '#features' },
                  { label: 'Languages', href: '#languages' },
                  { label: 'Pricing', href: '/pricing' },
                  { label: 'Conferly Class', href: '/class' },
                ],
              },
              {
                title: 'Resources',
                links: [
                  { label: 'Documentation' },
                  { label: 'API Reference' },
                  { label: 'System Status' },
                  { label: 'Release Notes' },
                ],
              },
              {
                title: 'Company',
                links: [
                  { label: 'About Us' },
                  { label: 'Privacy Policy' },
                  { label: 'Terms of Service' },
                  { label: 'Contact Us' },
                ],
              },
            ].map(col => (
              <div key={col.title} className="space-y-4">
                <h4 className="text-[13px] font-semibold text-slate-300">{col.title}</h4>
                <div className="space-y-2.5">
                  {col.links.map(link =>
                    'href' in link && link.href ? (
                      link.href.startsWith('#') ? (
                        <a
                          key={link.label}
                          href={link.href}
                          className="block text-[13px] text-slate-500 hover:text-white transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <button
                          key={link.label}
                          onClick={() => router.push(link.href!)}
                          className="block text-[13px] text-slate-500 hover:text-white transition-colors"
                        >
                          {link.label}
                        </button>
                      )
                    ) : (
                      <span key={link.label} className="block text-[13px] text-slate-500 cursor-default">
                        {link.label}
                      </span>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-slate-500">
            <span>© {new Date().getFullYear()} Conferly. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}