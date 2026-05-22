import Link from "next/link";
import Logo from "../../components/Logo";

export default function LobbyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo size="sm" className="text-white" />
          <Link href="/dashboard" className="text-sm text-slate-300 transition hover:text-white">
            Back to dashboard
          </Link>
        </header>

        <section className="mt-14 rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-lg shadow-black/20">
          <h1 className="text-3xl font-bold">Meeting lobby</h1>
          <p className="mt-4 text-slate-400">Prepare your call, configure access controls, and invite participants before joining the meeting room.</p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <h2 className="text-xl font-semibold text-white">Waiting room</h2>
              <p className="mt-3 text-slate-400">Review attendees before admitting them into the session.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <h2 className="text-xl font-semibold text-white">Meeting controls</h2>
              <p className="mt-3 text-slate-400">Set audio/video defaults, translation options, and access permissions.</p>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between gap-4">
            <Link href="/meeting" className="rounded-full bg-amber-400 px-7 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300">
              Enter meeting room
            </Link>
            <span className="text-sm text-slate-500">Room code: <strong className="text-white">CONFER123</strong></span>
          </div>
        </section>
      </div>
    </main>
  );
}
