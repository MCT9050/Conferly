import Link from "next/link";
import Logo from "../../components/Logo";
import LobbyPreJoin from "../../components/LobbyPreJoin";

interface LobbyPageProps {
  searchParams?: Promise<{ room?: string; roomId?: string; domain?: string; lessonId?: string }>;
}

export default async function LobbyPage({ searchParams }: LobbyPageProps) {
  const params = await searchParams;
  const roomId = params?.roomId || params?.room || "—";
  const domain = params?.domain || "meet";
  const lessonId = params?.lessonId;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo size="sm" className="text-white" />
          <Link
            href="/dashboard"
            className="text-sm text-slate-300 transition hover:text-white"
          >
            Back to dashboard
          </Link>
        </header>

        <section className="mt-14 rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-lg shadow-black/20">
          <h1 className="text-3xl font-bold text-center">Meeting lobby</h1>
          <p className="mt-4 text-slate-400 text-center max-w-2xl mx-auto">
            Check your camera and microphone, then join the meeting when
            you're ready.
          </p>

          <div className="mt-10">
            <LobbyPreJoin roomId={roomId} domain={domain} lessonId={lessonId} />
          </div>
        </section>
      </div>
    </main>
  );
}
