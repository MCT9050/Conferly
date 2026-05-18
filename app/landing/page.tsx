"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Globe, Languages, Users, MessageSquare, Zap, Shield, ArrowRight } from "lucide-react";
import { MobileMenu } from "@/components/MobileMenu";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-10 h-10" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg text-foreground/70 hover:text-accent hover:bg-secondary transition-colors"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

export default function LandingPage() {
  const features = [
    { 
      icon: Languages, 
      title: "School meetings", 
      desc: "Parents join in Zulu, Sotho, English — everyone understands.",
      color: "from-purple-500 to-purple-600"
    },
    { 
      icon: Users, 
      title: "Team updates", 
      desc: "Colleagues across regions collaborate in their language.",
      color: "from-purple-400 to-purple-500"
    },
    { 
      icon: MessageSquare, 
      title: "Community gatherings", 
      desc: "Rural communities participate without traveling.",
      color: "from-purple-600 to-purple-700"
    },
    { 
      icon: Shield, 
      title: "Enterprise security", 
      desc: "End-to-end encryption and SOC 2 compliance.",
      color: "from-purple-500 to-purple-600"
    },
    { 
      icon: Zap, 
      title: "Lightning fast", 
      desc: "Sub-second latency for real-time conversation.",
      color: "from-purple-400 to-purple-500"
    },
    { 
      icon: Globe, 
      title: "Global infrastructure", 
      desc: "Edge servers worldwide for smooth connections.",
      color: "from-purple-600 to-purple-700"
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileMenu />

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group hover:opacity-80 transition">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-xl font-bold shadow-lg">
              🎙️
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">Conferly</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium" role="navigation">
            <a href="#features" className="text-foreground/70 hover:text-accent transition-colors">Features</a>
            <a href="#pricing" className="text-foreground/70 hover:text-accent transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/auth" className="hidden lg:flex">
              <Button variant="ghost" className="text-foreground/70">Sign in</Button>
            </Link>
            <Link href="/auth" className="hidden lg:block">
              <Button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-lg hover:shadow-purple-500/30">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 overflow-hidden" role="region" aria-label="Hero section">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/30 to-background" aria-hidden="true" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-full blur-3xl animate-pulse" />
          <div 
            className="absolute -bottom-1/2 -right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-purple-600/8 to-purple-700/3 rounded-full blur-3xl animate-pulse" 
            style={{ animationDelay: '1s' }} 
          />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm font-medium">
              <Zap className="w-4 h-4" aria-hidden="true" />
              Real-time translation powered by AI
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 bg-clip-text text-transparent"
          >
            Connecting with Purpose
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xl md:text-2xl text-foreground/70 max-w-2xl mx-auto leading-relaxed"
          >
            Premium video conferencing rooted in Ubuntu. No downloads, no IT tickets, just seamless communication.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-wrap gap-4 justify-center"
          >
            <Link href="/auth">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-lg hover:shadow-purple-500/30 transition-all"
              >
                Start a meeting 
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="lg"
              className="border-border text-foreground/70 hover:bg-secondary transition-colors"
            >
              Copy meeting link
            </Button>
          </motion.div>

          {/* Features Row */}
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-sm text-foreground/60 font-medium"
          >
            No download required • Works in browser • Free for individuals
          </motion.p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4" id="features" role="region" aria-label="Features">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0 }} 
            whileInView={{ opacity: 1 }} 
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold text-center mb-4"
          >
            Built for every conversation
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0 }} 
            whileInView={{ opacity: 1 }} 
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-foreground/60 text-center mb-16 text-lg"
          >
            From school meetings to community gatherings.
          </motion.p>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.article 
                  key={feature.title} 
                  initial={{ opacity: 0, y: 30 }} 
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} 
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="group p-8 rounded-2xl bg-card/50 border border-border hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-foreground/60 leading-relaxed">{feature.desc}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-4 border-t border-border/50" role="region" aria-label="Call to action">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            whileInView={{ opacity: 1 }} 
            viewport={{ once: true }}
            className="inline-flex items-center gap-3 text-2xl font-bold"
          >
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              🛡️
            </div>
            Private. Secure. Built with purpose.
          </motion.div>

          <p className="text-foreground/60 text-lg">
            Your conversations stay yours.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border/50 text-foreground/60" role="contentinfo">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <p>© 2024 Conferly. Built for connection.</p>
          <div className="flex gap-6 text-sm">
            <a href="#privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#terms" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
