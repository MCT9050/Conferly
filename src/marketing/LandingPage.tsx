import { useState, useEffect } from 'react';
import {
  ArrowRight, Globe, Languages, Heart,
  Users, MessageSquare, FileText, CheckCircle2,
  Building2, Star
} from 'lucide-react';

interface LandingPageProps {
  roomId: string;
  setRoomId: (id: string) => void;
  userName: string;
  setUserName: (name: string) => void;
}

function generateRoomId() {
  const c = 'abcdefghijklmnopqrstuvwxyz';
  const s = [];
  for (let i = 0; i < 3; i++) {
    let x = '';
    for (let j = 0; j < 4; j++) x += c[Math.floor(Math.random() * c.length)];
    s.push(x);
  }
  return s.join('-');
}

const SCENARIOS = [
  { icon: Users, title: "School meetings that work", desc: "Parents join in Zulu, Sotho, English — everyone understands" },
  { icon: Building2, title: "Team updates", desc: "Colleagues across regions join in their own language" },
  { icon: MessageSquare, title: "Community gatherings", desc: "Rural communities participate without traveling" },
  { icon: FileText, title: "Recorded conversations", desc: "Key moments saved, shared with those who couldn't join" },
];

const TESTIMONIALS = [
  { name: 'Thandi Mokoena', role: 'Teacher, Johannesburg', text: "My Zulu-speaking parents can finally join school meetings.", avatar: 'TM', rating: 5 },
  { name: 'Pieter van der Merwe', role: 'Team Lead, Cape Town', text: "Our team spans three provinces. Translation means no one is left out.", avatar: 'PV', rating: 5 },
  { name: 'Naledi Khumalo', role: 'HR Director, Durban', text: "Onboarding 40 people took 5 minutes. Just works.", avatar: 'NK', rating: 5 },
  { name: 'Sipho Ndlovu', role: 'Community organizer, Pretoria', text: "Our village meetings now include family in the city.", avatar: 'SN', rating: 5 },
];

export default function LandingPage({ setRoomId, userName, setUserName }: Partial<LandingPageProps>) {
  const [_userName, setUserNameLocal] = useState(userName || '');
  const [copied, setCopied] = useState(false);

  const quickStart = () => {
    const roomId = generateRoomId();
    setRoomId(roomId);
    if (_userName) setUserName(_userName);
    window.location.hash = '#/auth';
  };

  const copyLink = () => {
    const url = `${window.location.origin}/#/${generateRoomId()}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold">
              🎙️
            </div>
            <span className="font-bold text-xl tracking-tight">Conferly</span>
          </div>
          <div className="hidden lg:flex items-center gap-8 text-[13px] text-slate-400 font-medium">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#scenarios" className="hover:text-white transition-colors">Use cases</a>
            <button onClick={() => window.location.hash = '#/learn'} className="hover:text-white transition-colors">Learn</button>
            <button onClick={() => window.location.hash = '#/pricing'} className="hover:text-white transition-colors">Pricing</button>
          </div>
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Connecting with Purpose
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-8">
            Real-time translation for every conversation. No downloads, no IT tickets, just seamless communication.
          </p>

          {/* Quick Start */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button
              onClick={quickStart}
              className="px-8 py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-semibold hover:from-amber-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2"
            >
              Start a meeting <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={copyLink}
              className="px-8 py-4 rounded-full border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              {copied ? 'Link copied!' : 'Copy meeting link'}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> No download required
            <CheckCircle2 className="w-4 h-4 text-green-500 ml-4" /> Works in browser
            <CheckCircle2 className="w-4 h-4 text-green-500 ml-4" /> Free for individuals
          </div>
        </div>
      </section>

      {/* Scenarios */}
      <section id="scenarios" className="py-20 px-4 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-center text-3xl font-bold mb-12">
            Built for <span className="text-amber-400">every conversation</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SCENARIOS.map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="bg-slate-800 rounded-2xl p-6 hover:bg-slate-700 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-3xl font-bold mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
              <h3 className="font-semibold mb-2">Click to start</h3>
              <p className="text-sm text-slate-400">Create a meeting in one click</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
              <h3 className="font-semibold mb-2">Share the link</h3>
              <p className="text-sm text-slate-400">Send to participants</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
              <h3 className="font-semibold mb-2">Speak naturally</h3>
              <p className="text-sm text-slate-400">Live translation enabled</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-center text-3xl font-bold mb-12">Trusted by teams everywhere</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TESTIMONIALS.map(({ name, role, text, avatar, rating }, i) => (
              <div key={i} className="bg-slate-800 rounded-2xl p-6">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-300 mb-4">"{text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-slate-900 font-semibold flex items-center justify-center">
                    {avatar}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-slate-500">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div>© 2024 Conferly. Built for connection.</div>
          <div className="flex gap-6">
            <a href="#/privacy" className="hover:text-white">Privacy</a>
            <a href="#/terms" className="hover:text-white">Terms</a>
            <a href="#/contact" className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
