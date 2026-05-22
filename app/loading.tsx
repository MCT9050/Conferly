export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
      <div className="space-y-2 text-center">
        <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-amber-400 animate-spin mx-auto" />
        <p className="text-sm">Loading Conferly...</p>
      </div>
    </div>
  );
}
