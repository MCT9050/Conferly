export default function MeetingRuntimeFallback() {
  return (
    <div className="min-h-[28rem] rounded-3xl border border-white/10 bg-slate-900/90 p-10 text-center text-slate-400">
      <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-slate-700 border-t-amber-400 animate-spin" />
      <p className="text-sm">Loading the Conferly meeting runtime...</p>
    </div>
  );
}
