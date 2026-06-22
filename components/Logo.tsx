interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: { icon: 'w-7 h-7', text: 'text-base', sub: 'text-[8px]', gap: 'gap-2' },
  md: { icon: 'w-9 h-9', text: 'text-lg', sub: 'text-[9px]', gap: 'gap-2.5' },
  lg: { icon: 'w-12 h-12', text: 'text-2xl', sub: 'text-[10px]', gap: 'gap-3' },
  xl: { icon: 'w-16 h-16', text: 'text-3xl', sub: 'text-xs', gap: 'gap-3.5' },
};

function LogoMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="conferly-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id="conferly-arc" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* Outer ring - unity */}
      <circle cx="20" cy="20" r="18" stroke="url(#conferly-gradient)" strokeWidth="3" fill="none" opacity="0.9" />
      {/* Inner connection arcs - conferencing */}
      <path d="M12 20 A8 8 0 0 1 20 12" stroke="url(#conferly-arc)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M28 20 A8 8 0 0 1 20 28" stroke="url(#conferly-gradient)" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Core node - people connecting */}
      <circle cx="20" cy="20" r="4" fill="url(#conferly-gradient)" />
      <circle cx="20" cy="20" r="6" fill="url(#conferly-gradient)" opacity="0.3" />
      {/* Connection dots */}
      <circle cx="12" cy="20" r="2.5" fill="#fbbf24" />
      <circle cx="28" cy="20" r="2.5" fill="#f59e0b" />
    </svg>
  );
}

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const s = SIZES[size];

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <LogoMark className={`${s.icon} rounded-xl`} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`${s.text} font-bold tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent`}>
            Conferly
          </span>
          {(size === 'lg' || size === 'xl') && (
            <span className={`${s.sub} text-slate-500 mt-1 italic`}>Connecting with Purpose</span>
          )}
        </div>
      )}
    </div>
  );
}