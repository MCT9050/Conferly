import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'Conferly requires an internet connection for sign-in, dashboards, meetings, and live data.',
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
      <section
        aria-labelledby="offline-title"
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl"
      >
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Connection unavailable
        </p>
        <h1 id="offline-title" className="text-3xl font-bold">
          You&apos;re offline
        </h1>
        <p className="mt-4 leading-7 text-slate-300">
          Conferly can show this guidance while offline, but meetings, sign-in,
          dashboards, and live data require an active internet connection.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Reconnect to the internet, then try your request again.
        </p>
        <a
          href=""
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          Retry connection
        </a>
      </section>
    </main>
  );
}