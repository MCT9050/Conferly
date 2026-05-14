"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Menu, X, Globe, Languages, Users, MessageSquare, Zap, Shield, ArrowRight } from "lucide-react";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);
  
  if (!mounted) return <div className="w-10 h-10" />;
  
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
    >
      {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm lg:hidden"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold text-xl text-white">Conferly</span>
              <button onClick={onClose} className="p-2 text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="space-y-2">
              <Link href="/auth" onClick={onClose}>
                <Button variant="ghost" className="w-full justify-start text-slate-300">
                  Sign in
                </Button>
              </Link>
              <Link href="/auth" onClick={onClose}>
                <Button className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900">
                  Get started
                </Button>
              </Link>
            </nav>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const features = [
    { icon: Languages, title: "School meetings", desc: "Parents join in Zulu, Sotho, English — everyone understands." },
    { icon: Users, title: "Team updates", desc: "Colleagues across regions collaborate in their language." },
    { icon: MessageSquare, title: "Community gatherings", desc: "Rural communities participate without traveling." },
    { icon: Shield, title: "Enterprise security", desc: "End-to-end encryption and SOC 2 compliance." },
    { icon: Zap, title: "Lightning fast", desc: "Sub-second latency for real-time conversation." },
    { icon: Globe, title: "Global infrastructure", desc: "Edge servers worldwide for smooth connections." },
  ];
  
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xl font-bold">
              🎙️
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">Conferly</span>
          </Link>
          
          <nav className="hidden lg:flex items-center gap-2">
            <button className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Features</button>
            <button className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Pricing</button>
          </nav>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 lg:hidden text-slate-400">
              <Menu className="w-6 h-6" />
            </button>
            <Link href="/auth" className="hidden lg:flex">
              <Button variant="ghost" className="text-slate-300">Sign in</Button>
            </Link>
            <Link href="/auth" className="hidden lg:block">
              <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-24 pb-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <Zap className="w-4 h-4" />Real-time translation powered by AI
            </span>
          </motion.div>
          
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Connecting with Purpose
          </motion.h1>
          
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto">
            Premium video conferencing rooted in Ubuntu. No downloads, no IT tickets, just seamless communication.
          </motion.p>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-4 justify-center">
            <Link href="/auth">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900">
                Start a meeting <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Copy meeting link
            </Button>
          </motion.div>
          
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-sm text-slate-500">
            No download required • Works in browser • Free for individuals
          </motion.p>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-4">Built for every conversation</motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-slate-400 text-center mb-16">From school meetings to community gatherings.</motion.p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="group p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/30 transition-all hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <p className="text-slate-500">© 2024 Conferly. Built for connection.</p>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="#" className="hover:text-white">Privacy</Link>
            <Link href="#" className="hover:text-white">Terms</Link>
            <Link href="#" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}