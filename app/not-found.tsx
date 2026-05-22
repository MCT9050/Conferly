import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white px-5 text-center">
      <p className="text-sm uppercase tracking-[0.35em] text-amber-400">404</p>
      <h1 className="mt-4 text-4xl font-bold">Page not found</h1>
      <p className="mt-3 max-w-xl text-slate-400">The page you are looking for does not exist or has moved. Return to the Conferly home page to continue.</p>
      <Link href="/" className="mt-8 inline-flex rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300">
        Back to home
      </Link>
    </main>
  );
}
