"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen, Users, GraduationCap, Shield, ArrowRight,
  CheckCircle2, Play, Star, Heart, MessageSquare,
  Brain, Languages, ClipboardList, FileText, DollarSign,
  BarChart3, Zap, Monitor, ArrowDown, Globe
} from 'lucide-react';
import Logo from '../../components/Logo';
import { getSession } from '../../lib/supabaseClient';

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

export default function ClassLandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    getSession().then(session => {
      if (session?.user) setIsLoggedIn(true);
    }).catch(() => {});
  }, []);

  const quickStart = useCallback(() => {
    if (!isLoggedIn) {
      router.push('/auth?product=class');
      return;
    }
    router.push(`/class/classrooms/${generateRoomId()}`);
  }, [isLoggedIn, router]);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-slate-950">
      {/* ═══ NAV ═══ */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10">
              Class
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-[13px] text-slate-400 font-medium">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#for-tutors" className="hover:text-white transition-colors">For Tutors</a>
            <button
              onClick={() => router.push('/class/pricing')}
              className="hover:text-white transition-colors"
            >
              Pricing
            </button>
            <a href="/pricing" className="text-blue-400 hover:text-blue-300 transition-colors">
              Conferly Meet →
            </a>
          </div>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <button
                onClick={() => router.push('/class/dashboard')}
                className="px-5 py-2 rounded-full bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-500 transition-colors"
              >
                Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push('/auth?product=class')}
                  className="text-[13px] text-slate-400 hover:text-white font-medium transition-colors"
                >
                  Log in
                </button>
                <button
                  onClick={() => router.push('/auth?product=class')}
                  className="px-5 py-2 rounded-full bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Start Teaching Free
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative px-5 sm:px-8 pt-20 sm:pt-28 pb-16 sm:pb-24">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16 sm:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-[13px] text-emerald-300 mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              The complete classroom for tutors and trainers
            </div>

            <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-[1.08] tracking-[-0.03em] mb-6">
              Your virtual classroom,
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent">
                reimagined.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Whiteboard, lesson plans, student rosters, assignments, and payments — 
              <span className="text-white font-medium"> all in one place.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button
                onClick={quickStart}
                className="group px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-[15px] flex items-center gap-2.5 shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300"
              >
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {isLoggedIn ? 'Create a Classroom' : 'Create Your First Classroom'}
              </button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 rounded-full border border-white/10 text-slate-300 font-medium text-[15px] hover:bg-white/5 hover:border-white/20 transition-all duration-300 flex items-center gap-2"
              >
                See how it works
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-green-400/70" />
                Interactive whiteboard
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400/70" />
                Student roster
              </span>
              <span className="flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-cyan-400/70" />
                Assignments & grading
              </span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-yellow-400/70" />
                Payment collection
              </span>
            </div>
          </div>

          {/* Mockup */}
          <div className="relative max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800/80 border-b border-white/5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-3 text-[11px] text-slate-500 font-mono">class.conferly.site — Classroom</span>
              </div>
              <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <BookOpen className="w-16 h-16 text-emerald-400/50 mx-auto" />
                  <p className="text-slate-500 text-sm">Interactive Whiteboard + Student Grid</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="px-8 py-20 sm:py-24 border-y border-slate-800/50">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '1', suffix: '', label: 'Classrooms', sub: 'Free tier' },
            { value: '5', suffix: '', label: 'Students', sub: 'Per classroom' },
            { value: 'R89', suffix: '', label: 'Starting at', sub: 'Classroom plan' },
            { value: '14', suffix: 'day', label: 'Free trial', sub: 'No credit card' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                {s.value}{s.suffix}
              </div>
              <div className="text-sm font-semibold text-slate-300 mt-2">{s.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="text-[13px] text-emerald-400 font-semibold uppercase tracking-widest mb-4">Features</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Everything a tutor needs.
              <br />
              <span className="text-slate-500">Nothing a student shouldn't see.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: BookOpen,     title: 'Interactive Whiteboard',  desc: 'Real-time collaborative drawing, text, and math tools for live lessons.',          gradient: 'from-emerald-500/10 to-emerald-600/5', accent: 'text-emerald-400', border: 'hover:border-emerald-500/20' },
              { icon: Users,        title: 'Student Roster',           desc: 'Manage enrollments, track attendance, and see progress at a glance.',               gradient: 'from-cyan-500/10 to-cyan-600/5',     accent: 'text-cyan-400',    border: 'hover:border-cyan-500/20' },
              { icon: ClipboardList, title: 'Assignments & Grading',   desc: 'Create, distribute, and grade assignments with automatic score tracking.',            gradient: 'from-purple-500/10 to-purple-600/5', accent: 'text-purple-400',  border: 'hover:border-purple-500/20' },
              { icon: FileText,     title: 'Lesson Plans',             desc: 'Build structured lesson plans with rich content, attachments, and scheduling.',      gradient: 'from-amber-500/10 to-amber-600/5',   accent: 'text-amber-400',   border: 'hover:border-amber-500/20' },
              { icon: DollarSign,   title: 'Payment Collection',       desc: 'Collect tuition via Lemon Squeezy. Set your own prices for courses and sessions.',   gradient: 'from-green-500/10 to-green-600/5',   accent: 'text-green-400',   border: 'hover:border-green-500/20' },
              { icon: Monitor,      title: 'Live Recordings',          desc: 'Record lessons for students who missed class. Playback available on demand.',        gradient: 'from-pink-500/10 to-pink-600/5',     accent: 'text-pink-400',    border: 'hover:border-pink-500/20' },
              { icon: Brain,        title: 'AI Pulse for Class',       desc: 'Auto-generated lesson summaries and key takeaways after each session.',              gradient: 'from-blue-500/10 to-blue-600/5',     accent: 'text-blue-400',    border: 'hover:border-blue-500/20' },
              { icon: Languages,    title: 'Multi-language Support',   desc: 'Teach in your language. Live translation for 11 SA languages supports diverse students.', gradient: 'from-rose-500/10 to-rose-600/5',  accent: 'text-rose-400', border: 'hover:border-rose-500/20' },
            ].map(f => (
              <div
                key={f.title}
                className={`group relative rounded-2xl border border-white/5 ${f.border} p-6 bg-gradient-to-b ${f.gradient} transition-all duration-300 hover:-translate-y-1`}
              >
                <div className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-4 ${f.accent} group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-[15px] mb-2">{f.title}</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOR TUTORS ═══ */}
      <section id="for-tutors" className="px-5 sm:px-8 py-20 sm:py-28 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Built for
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                independent educators.
              </span>
            </h2>
            <p className="text-slate-400">Everything you need to run your tutoring business — from one dashboard.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'For Tutors',
                price: 'R89',
                period: '/month',
                features: ['5 classrooms', '25 students', 'Whiteboard + recordings', 'Student roster', 'Assignments'],
                gradient: 'from-emerald-600 to-teal-500',
                popular: true,
              },
              {
                title: 'For Training Businesses',
                price: 'R220',
                period: '/month',
                features: ['Unlimited classrooms', 'Up to 100 students', 'Grading & submissions', 'Payment collection'],
                gradient: 'from-emerald-700 to-teal-600',
                popular: false,
              },
              {
                title: 'For Institutions',
                price: 'Custom',
                period: '',
                features: ['Unlimited everything', 'White-label branding', 'API access', 'Dedicated success manager'],
                gradient: 'from-amber-500 to-orange-500',
                popular: false,
              },
            ].map(plan => (
              <div
                key={plan.title}
                className={`rounded-2xl border p-7 space-y-5 transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? 'border-emerald-500/30 bg-emerald-500/[0.03] shadow-lg shadow-emerald-500/5'
                    : 'border-slate-800/50 bg-slate-900/60'
                }`}
              >
                {plan.popular && (
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                    Most Popular
                  </span>
                )}
                <div>
                  <h3 className="text-xl font-bold text-white">{plan.title}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                  {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
                </div>
                <div className="space-y-2.5">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-[13px] text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push('/class/pricing')}
                  className={`w-full py-3 min-h-[44px] rounded-xl bg-gradient-to-r ${plan.gradient} text-white font-semibold text-sm transition-all duration-300 hover:opacity-90 shadow-lg`}
                >
                  {plan.price === 'Custom' ? 'Contact Sales' : `Get ${plan.title}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-slate-800/50 bg-gradient-to-b from-emerald-600/[0.06] to-transparent p-10 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="relative z-10 space-y-8">
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Ready to transform your
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  teaching experience?
                </span>
              </h2>
              <p className="text-lg text-slate-400 max-w-xl mx-auto">
                No credit card. No contracts. Create your first classroom in 30 seconds.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={quickStart}
                  className="group px-10 py-4 rounded-full bg-white text-slate-900 font-semibold text-[15px] flex items-center gap-2.5 shadow-2xl shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] transition-all duration-300"
                >
                  <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  {isLoggedIn ? 'Create Classroom' : 'Create Your First Classroom'}
                </button>
                <button
                  onClick={() => router.push('/class/pricing')}
                  className="px-10 py-4 rounded-full border border-white/10 text-slate-300 font-medium text-[15px] hover:bg-white/5 transition-all duration-300 flex items-center gap-2"
                >
                  View Pricing
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="px-5 sm:px-8 py-16 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">
            <div className="space-y-4">
              <Logo size="sm" />
              <p className="text-[13px] text-slate-500 leading-relaxed max-w-xs">
                The complete virtual classroom platform for tutors, coaches, and training businesses in South Africa.
              </p>
            </div>
            {[
              {
                title: 'Product',
                links: [
                  { label: 'Features', href: '#features' },
                  { label: 'Pricing', href: '/class/pricing' },
                  { label: 'Conferly Meet', href: '/' },
                ],
              },
              {
                title: 'Support',
                links: [
                  { label: 'Documentation' },
                  { label: 'Contact Us' },
                  { label: 'Status' },
                ],
              },
              {
                title: 'Legal',
                links: [
                  { label: 'Privacy Policy' },
                  { label: 'Terms of Service' },
                ],
              },
            ].map(col => (
              <div key={col.title} className="space-y-4">
                <h4 className="text-[13px] font-semibold text-slate-300">{col.title}</h4>
                <div className="space-y-2.5">
                  {col.links.map(link =>
                    'href' in link && link.href ? (
                      <button
                        key={link.label}
                        onClick={() => router.push(link.href!)}
                        className="block text-[13px] text-slate-500 hover:text-white transition-colors"
                      >
                        {link.label}
                      </button>
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
          <div className="pt-8 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-slate-500">
            <span>© {new Date().getFullYear()} Conferly. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <span>Privacy</span>
              <span>Terms</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}