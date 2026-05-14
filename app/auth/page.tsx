"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

type AuthMode = "signin" | "signup" | "forgot";

const fadeVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        if (mode === "forgot") {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth?reset=true`,
          });
          if (error) throw error;
          setSuccess("Check your email for a password reset link!");
          setLoading(false);
          return;
        }

        if (mode === "signup") {
          if (password.length < 6) {
            setError("Password must be at least 6 characters");
            setLoading(false);
            return;
          }

          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: name } },
          });
          if (error) throw error;
          if (data.user) {
            setSuccess("Welcome! Check your email to confirm your account.");
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          router.push("/dashboard");
          return;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Authentication failed";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, name, router]
  );

  const toggleMode = useCallback((newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-3xl shadow-xl shadow-amber-500/20">
              🎙️
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 text-3xl font-bold text-white"
          >
            Conferly
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-2 text-slate-400"
          >
            {mode === "signin"
              ? "Welcome back. Sign in to continue."
              : mode === "forgot"
              ? "Enter your email to receive a reset link."
              : "Create your free account to get started."}
          </motion.p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle></CardTitle>
            <CardDescription></CardDescription>
          </CardHeader>

          <CardContent>
            {/* Error/Success Alerts */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Alert variant="success" className="mb-4">
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {mode !== "forgot" && (
                  <motion.div
                    key="name"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="name">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="pl-11"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="pl-11"
                  />
                </div>
              </div>

              <AnimatePresence>
                {mode !== "forgot" && (
                  <motion.div
                    key="password"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required={mode === "signup"}
                        className="pl-11 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : mode === "signin" ? (
                  <>
                    Sign In <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : mode === "forgot" ? (
                  "Send Reset Link"
                ) : (
                  <>
                    Sign Up <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <AnimatePresence mode="wait">
              {mode === "signin" && (
                <motion.div
                  key="signin-footer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full text-center space-y-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleMode("forgot")}
                    className="text-sm text-slate-500 hover:text-slate-400"
                  >
                    Forgot your password?
                  </button>
                  <p className="text-sm text-slate-500">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => toggleMode("signup")}
                      className="text-amber-500 hover:text-amber-400 font-medium"
                    >
                      Sign up free
                    </button>
                  </p>
                </motion.div>
              )}

              {mode === "signup" && (
                <motion.div
                  key="signup-footer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full text-center"
                >
                  <p className="text-sm text-slate-500">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => toggleMode("signin")}
                      className="text-amber-500 hover:text-amber-400 font-medium"
                    >
                      Sign in
                    </button>
                  </p>
                </motion.div>
              )}

              {mode === "forgot" && (
                <motion.div
                  key="forgot-footer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full text-center"
                >
                  <button
                    type="button"
                    onClick={() => toggleMode("signin")}
                    className="text-sm text-amber-500 hover:text-amber-400"
                  >
                    Back to sign in
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === "signin" && (
              <Link
                href="/landing"
                className="text-center text-sm text-slate-500 hover:text-slate-400"
              >
                Learn more about Conferly →
              </Link>
            )}
          </CardFooter>
        </Card>

        {/* Security note */}
        <p className="text-center text-xs text-slate-600 mt-4">
          Encrypted authentication • Secured by Supabase
        </p>
      </motion.div>
    </main>
  );
}