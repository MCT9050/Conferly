"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white px-5 text-center">
      <p className="text-sm uppercase tracking-[0.35em] text-amber-400">Application error</p>
      <h1 className="mt-4 text-4xl font-bold">Something went wrong.</h1>
      <p className="mt-3 max-w-xl text-slate-400">An unexpected error occurred while rendering this page. Please try again or return home.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button onClick={() => reset()} className="rounded-full bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
          Retry
        </button>
        <Link href="/" className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300">
          Home
        </Link>
      </div>
    </main>
  );
}
