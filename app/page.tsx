import Link from "next/link";
import Logo from "../components/Logo";

const features = [
  { title: 'HD video conferencing', description: 'Crystal-clear meetings with low latency and intelligent media handling.' },
  { title: 'Live translation', description: '11 South African languages supported for inclusive conversations.' },
  { title: 'AI summaries', description: 'Meeting notes and pulse insights generated automatically after every call.' },
  { title: 'Secure by design', description: 'End-to-end encryption, waiting room controls, and password-protected meetings.' },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6">
        <nav className="flex items-center justify-between py-4">
          <Logo size="md" className="text-white" />
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition">Features</a>
            <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
            <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
          </div>
        </nav>

        <section className="grid gap-12 lg:grid-cols-[1.2fr,0.8fr] items-center py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Built for secure hybrid collaboration
            </div>
            <h1 className="mt-8 text-5xl font-extrabold tracking-tight sm:text-6xl">
              Conferly for modern team meetings
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl">
              Connect with colleagues, clients, and communities using a Next.js-native conferencing platform built for speed, security, and real-time collaboration.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full bg-amber-400 px-8 py-4 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300">
                Try Conferly
              </Link>
              <a href="#features" className="inline-flex items-center justify-center rounded-full border border-slate-700 px-8 py-4 text-sm text-slate-200 transition hover:bg-slate-800/70">
                See features
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/40">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-950/80 border-b border-white/10">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-auto text-[11px] text-slate-500">conferly.site</span>
            </div>
            <img src="/images/app-mockup.png" alt="Conferly meeting interface" className="w-full object-cover" />
          </div>
        </section>
      </div>

      <section id="features" className="border-t border-white/5 bg-slate-950/95 py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-4">
            {features.map(feature => (
              <div key={feature.title} className="rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-lg shadow-black/10">
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-amber-400">Trusted by innovative teams</p>
              <h2 className="mt-3 text-3xl font-bold text-white">Built for real teams and real growth.</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center text-sm text-slate-500 sm:grid-cols-3 lg:grid-cols-6">
              {['EduConnect', 'HealthBridge', 'GovConnect', 'StartupHub SA', 'AfriFinance', 'TechLaunch'].map(name => (
                <div key={name} className="rounded-2xl bg-slate-900/70 px-4 py-3">{name}</div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
