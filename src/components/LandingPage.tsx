import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Globe, Languages, Heart,
  Users, MessageSquare, FileText, CheckCircle2,
  ArrowDown, Shield, Building2, Star
} from 'lucide-react';
import type { AppView } from '../types';
import type { UserProfile } from '../hooks/useAuth';
import ProfileMenu from './ProfileMenu';
import Logo from './Logo';

interface LandingPageProps {
  
  roomId: string;
  setRoomId: (id: string) => void;
  userName: string;
  setUserName: (name: string) => void;
  profile: UserProfile | null;
  isOfflineMode: boolean;
  onSignOut: () => void;
  onUpdateName: (name: string) => Promise<{ success: boolean }>;
}

function generateRoomId() {
  const c = 'abcdefghijklmnopqrstuvwxyz';
  const s = [];
  for (let i = 0; i < 3; i++) { let x = ''; for (let j = 0; j < 4; j++) x += c[Math.floor(Math.random() * c.length)]; s.push(x); }
  return s.join('-');
}

const SCENARIOS = [
  { icon: Users, title: "School meetings that work", desc: "Parents join in Zulu, Sotho, English — everyone understands" },
  { icon: Building2, title: "Team updates", desc: "Colleagues across regions join in their own language" },
  { icon: MessageSquare, title: "Community gatherings", desc: "Rural communities participate without traveling" },
  { icon: FileText, title: "Recorded conversations", desc: "Key moments saved, shared with those who couldn't join" },
];

const TESTIMONIALS = [
  { name: 'Thandi Mokoena', role: 'Teacher, Johannesburg', text: 'My Zulu-speaking parents can finally join school meetings. Everyone participates now.', avatar: 'TM', rating: 5 },
  { name: 'Pieter van der Merwe', role: 'Team Lead, Cape Town', text: 'Our team spans three provinces. Translation means no one is left out.', avatar: 'PV', rating: 5 },
  { name: 'Naledi Khumalo', role: 'HR Director, Durban', text: 'Onboarding 40 people took 5 minutes. No downloads, no IT tickets. Just works.', avatar: 'NK', rating: 5 },
  { name: 'Sipho Ndlovu', role: 'Community organizer, Pretoria', text: 'Our village meetings now include family in the city. That matters.', avatar: 'SN', rating: 5 },
];

export default function LandingPage({ setRoomId, userName, setUserName, profile, isOfflineMode, onSignOut, onUpdateName }: Partial<LandingPageProps>) {
  const isLoggedIn = !!profile;

  const quickStart = () => {
    if (!isLoggedIn) { window.location.hash = '#/dashboard'; return; }
    if (!userName && profile) setUserName(profile.displayName);
    setRoomId(generateRoomId());
    window.location.hash = '#/lobby';
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* NAV */}
      <nav className="glass sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between">
          <Logo size="md" />
          <div className="hidden lg:flex items-center gap-8 text-[13px] text-slate-400 font-medium">
            <a href="#how" className="hover:text-white transition-colors duration-200">How it works</a>
            <a href="#scenarios" className="hover:text-white transition-colors duration-200">Use cases</a>
            <button onClick={() => window.location.hash = '#/learn'} className="hover:text-white transition-colors duration-200">Learn</button>
            <button onClick={() => window.location.hash = '#/pricing'} className="hover:text-white transition-colors duration-200">Pricing</button>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <ProfileMenu profile={profile!} isOfflineMode={isOfflineMode} onSignOut={onSignOut} onUpdateName={onUpdateName} />
            ) : (
              <>
                <button 
                  onClick={() => window.location.hash = '#/auth'} 
                  className="hidden sm:block text-[13px] text-slate-400 hover:text-white font-medium transition-colors"
                >
                  Sign in
                </button>
                <button 
                  onClick={() => window.location.hash = '#/auth'} 
                  className="px-5 py-2 rounded-full bg-white text-slate-900 text-[13px] font-semibold hover:bg-slate-100 transition-colors shadow-lg shadow-white/10"
                >
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative px-5 sm:px-8 pt-20 sm:pt-28 pb-16 sm:pb-24">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-orange-500/8 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16 sm:mb-20">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-[13px] text-amber-300 mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              "I am because we are" — Ubuntu philosophy
            </div>

            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.08] tracking-[-0.03em] mb-6">
              Where every voice
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">is heard.</span>
              <br />
              Every language.
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
              A space for teams, schools, and communities to communicate 
              <span className="text-white font-medium"> across language barriers.</span> 
              No downloads. No complexity. Just conversation.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button onClick={quickStart}
                className="group px-8 py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-[15px] flex items-center gap-2.5 shadow-2xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] transition-all duration-300">
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                {isLoggedIn ? 'Start a conversation' : 'Start a conversation'}
              </button>
              <button onClick={() => { const el = document.getElementById('how'); el?.scrollIntoView({ behavior: 'smooth' }); }}
                className="px-8 py-4 rounded-full border border-white/10 text-slate-300 font-medium text-[15px] hover:bg-white/5 hover:border-white/20 transition-all duration-300 flex items-center gap-2">
                See how it works
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>

            {/* Trust */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-green-400/70" />Conversations stay private</span>
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-amber-400/70" />Works in any browser</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="px-5 sm:px-8 py-20 sm:py-28 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[13px] text-amber-400 font-semibold uppercase tracking-widest mb-4">How Conferly works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Bring everyone into the conversation
            </h2>
            <p className="text-lg text-slate-400 max-w-xl mx-auto">
              Three simple steps. No downloads. No learning curve.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Start or join', desc: 'Share a link. Anyone clicks and joins from their browser — no account needed to participate.' },
              { step: '02', title: 'Speak your language', desc: 'Choose your language. Others hear translations in their preferred language.' },
              { step: '03', title: 'Continue later', desc: 'Key moments are saved. Those who missed it can catch up anytime.' },
            ].map(item => (
              <div key={item.step} className="relative p-8 rounded-2xl border border-white/5 bg-white/[0.01] hover:border-white/10 transition-colors">
                <div className="text-5xl font-extrabold text-white/5 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCENARIOS */}
      <section id="scenarios" className="px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[13px] text-amber-400 font-semibold uppercase tracking-widest mb-4">Use cases</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Built for how teams actually work
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SCENARIOS.map(s => (
              <div key={s.title} className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 hover:border-white/10 transition-colors">
                <s.icon className="w-8 h-8 text-amber-400 mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">{s.title}</h3>
                <p className="text-[13px] text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LANGUAGES */}
      <section className="px-5 sm:px-8 py-20 sm:py-28 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-[13px] text-cyan-300 mb-8">
            <Languages className="w-4 h-4" />
            Multilingual by design
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6">
            Everyone understands
          </h2>
          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-8">
            Real-time translation means your Zulu-speaking parents, Sotho-speaking colleagues, 
            and English-speaking partners all participate. No one is left out.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Zulu', 'Xhosa', 'Sotho', 'English', 'Afrikaans', 'Tswana', 'Venda', 'Ndebele'].map(lang => (
              <span key={lang} className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-[13px] text-slate-300">
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[13px] text-amber-400 font-semibold uppercase tracking-widest mb-4">Voices from teams</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Stories from<br /><span className="bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">South African teams.</span></h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-4 hover:border-white/10 transition-colors duration-300">
                <div className="flex gap-0.5">{Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />)}</div>
                <p className="text-[13px] text-slate-300 leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-[11px] font-bold">{t.avatar}</div>
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

      {/* PRICING */}
      <section id="pricing" className="px-5 sm:px-8 py-20 sm:py-28 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[13px] text-amber-400 font-semibold uppercase tracking-widest mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Simple. Transparent.
            </h2>
            <p className="text-lg text-slate-400">
              No per-minute pricing. No enterprise negotiations. Just participation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: 'Community', price: 'Free', period: 'Forever', features: ['Up to 25 people', '40-minute conversations', 'Basic translation', 'Community support'], gradient: 'from-slate-600 to-slate-700', cta: 'Start free' },
              { name: 'Teams', price: 'R199', period: '/month', features: ['Unlimited conversations', 'Larger meetings', 'Priority translation', 'Recording & transcripts', 'Priority support'], gradient: 'from-amber-500 to-orange-500', cta: 'Start trial' },
              { name: 'Organization', price: 'Custom', period: '', features: ['Everything in Teams', 'SSO & admin', 'Dedicated support', 'Custom integrations'], gradient: 'from-blue-500 to-cyan-500', cta: 'Contact us', highlight: true },
            ].map(plan => (
              <div key={plan.name} className={`relative p-6 sm:p-8 rounded-2xl border ${plan.highlight ? 'border-amber-500/30 bg-amber-500/[0.03]' : 'border-white/10 bg-white/[0.02]'} ${plan.highlight ? 'md:-mt-4 md:mb-4' : ''}`}>
                {plan.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-[11px] font-semibold text-slate-900">Most popular</div>}
                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
                </div>
                <div className="space-y-3 mb-6">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-[13px] text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400/80 shrink-0" />{f}
                    </div>
                  ))}
                </div>
                <button onClick={() => window.location.hash = '#/auth'}
                  className={`w-full py-3 min-h-[44px] rounded-xl bg-gradient-to-r ${plan.gradient} text-white font-semibold text-sm transition-all duration-300 hover:opacity-90 shadow-lg`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-amber-600/[0.06] to-transparent p-10 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="relative z-10 space-y-8">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                Ready to gather?
              </h2>
              <p className="text-lg text-slate-400 max-w-xl mx-auto">
                Your first conversation starts in seconds. No credit card. No downloads.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={quickStart}
                  className="group px-10 py-4 rounded-full bg-white text-slate-900 font-semibold text-[15px] flex items-center gap-2.5 shadow-2xl shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] transition-all duration-300">
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  {isLoggedIn ? 'Start conversation' : 'Get started'}
                </button>
                <button onClick={() => window.location.hash = '#/pricing'}
                  className="px-10 py-4 rounded-full border border-white/10 text-slate-300 font-medium text-[15px] hover:bg-white/5 transition-all duration-300 flex items-center gap-2">
                  View plans
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-5 sm:px-8 py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-14">
            <div className="lg:col-span-2 space-y-4">
              <Logo size="sm" />
              <p className="text-[13px] text-slate-500 leading-relaxed max-w-xs">A collaborative communication space built for teams, schools, and communities across Africa.</p>
              <div className="flex items-center gap-1.5 text-[12px] text-slate-600">
                Made with <Heart className="w-3 h-3 text-red-400/60" /> in Africa
              </div>
            </div>
            {[
              { title: 'Product', links: [{ label: 'How it works', href: '#how' }, { label: 'Use cases', href: '#scenarios' }, { label: 'Pricing', action: () => window.location.hash = '#/pricing' }, { label: 'Learn', action: () => window.location.hash = '#/learn' }] },
              { title: 'Resources', links: [{ label: 'Documentation', action: () => window.location.hash = '#/docs' }, { label: 'Privacy', action: () => window.location.hash = '#/privacy' }, { label: 'Terms', action: () => window.location.hash = '#/terms' }] },
              { title: 'Company', links: [{ label: 'About', action: () => window.location.hash = '#/about' }, { label: 'Contact', action: () => window.location.hash = '#/contact' }, { label: 'Careers', action: () => window.location.hash = '#/careers' }] },
            ].map(col => (
              <div key={col.title} className="space-y-4">
                <h4 className="text-[13px] font-semibold text-slate-300">{col.title}</h4>
                <div className="space-y-2.5">
                  {col.links.map(link => (
                    'action' in link && link.action ? (
                      <button key={link.label} onClick={link.action} className="block text-[13px] text-slate-500 hover:text-white transition-colors">{link.label}</button>
                    ) : 'href' in link && link.href ? (
                      <a key={link.label} href={link.href} className="block text-[13px] text-slate-500 hover:text-white transition-colors">{link.label}</a>
                    ) : (
                      <span key={link.label} className="block text-[13px] text-slate-600 cursor-default">{link.label}</span>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-slate-600">
            <span>© {new Date().getFullYear()} Conferly. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <button onClick={() => window.location.hash = '#/privacy'} className="hover:text-white transition-colors">Privacy</button>
              <button onClick={() => window.location.hash = '#/terms'} className="hover:text-white transition-colors">Terms</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}