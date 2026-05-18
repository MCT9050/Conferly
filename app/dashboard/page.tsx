"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { LogOut, Video, Users, Calendar, Settings, Plus, ArrowRight, Loader2 } from "lucide-react";

function createRoomId() {
  return 'room-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const startMeeting = useCallback(async () => {
    setCreating(true);
    const roomId = createRoomId();
    // For now, just navigate directly (would create room in DB in production)
    router.push(`/room/${roomId}`);
  }, [router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const handleStartMeeting = () => {
    startMeeting();
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xl">
              🎙️
            </div>
            <span className="font-bold text-xl text-white">Conferly</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden sm:block">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="text-slate-400 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back! 👋
          </h1>
          <p className="text-slate-400">
            Ready to connect with your team?
          </p>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { icon: Video, label: "Start Meeting", color: "from-amber-500 to-amber-600" },
            { icon: Calendar, label: "Schedule", href: "#", color: "from-emerald-500 to-emerald-600" },
            { icon: Users, label: "Invite Team", href: "#", color: "from-blue-500 to-blue-600" },
            { icon: Settings, label: "Settings", href: "#", color: "from-purple-500 to-purple-600" },
          ].map((action, i) => {
              const isStartMeeting = action.label === "Start Meeting";
              const href = isStartMeeting ? `/room/${createRoomId()}` : (action.href || "#");
              return (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
            >
              <Link
                href={href}
                className={`block p-6 rounded-2xl bg-gradient-to-br ${action.color} shadow-lg hover:shadow-xl transition-shadow`}
              >
                <action.icon className="w-8 h-8 text-white mb-3" />
                <span className="text-white font-medium">{action.label}</span>
              </Link>
            </motion.div>
              );
            })}
        </div>

        {/* Recent Meetings */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Recent meetings</h2>
            <Link
              href="#"
              className="text-sm text-amber-500 hover:text-amber-400 flex items-center"
            >
              View all <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-slate-500 text-center">
              No recent meetings. Start a new meeting to get started.
            </p>
            <div className="mt-4 flex justify-center">
              <Link href="/room/new">
                <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900">
                  <Plus className="w-4 h-4 mr-2" />
                  Start Meeting
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}