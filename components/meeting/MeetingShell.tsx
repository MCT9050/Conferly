import Logo from '../Logo';

export default function MeetingShell() {
  return (
    <section className="border-b border-white/10 bg-slate-950/95 text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-400">
              <span>Meeting room</span>
              <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold">App Router native</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Logo size="md" className="text-white" />
                <div>
                  <p className="text-2xl font-bold tracking-tight">Conferly meeting experience</p>
                  <p className="text-sm text-slate-400">Server-rendered shell with targeted client islands for media, chat, transcription, translation, recording, and collaboration.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Meeting code', value: 'CONFER123' },
              { label: 'Participant cap', value: '16 people' },
              { label: 'Latency target', value: '<100ms' },
            ].map(entry => (
              <div key={entry.label} className="rounded-3xl bg-slate-900/90 border border-white/10 p-4 text-sm">
                <div className="text-slate-500 uppercase tracking-[0.22em] text-[10px] mb-2">{entry.label}</div>
                <div className="text-base font-semibold text-white">{entry.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
