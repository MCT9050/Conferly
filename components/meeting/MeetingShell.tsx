import Logo from '../Logo';

interface MeetingShellProps {
  roomId?: string;
  participantCap?: string;
}

export default function MeetingShell({ roomId = '\u2014', participantCap = '16 people' }: MeetingShellProps) {
  return (
    <section className="border-b border-white/10 bg-slate-950/95 text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Logo size="sm" className="text-white shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">Conferly Meeting</p>
              <p className="text-xs text-slate-400 truncate">
                Room <span className="font-mono text-slate-300">{roomId}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border border-white/5">
              {participantCap}
            </span>
            <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-400 border border-green-500/20">
              Live
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
