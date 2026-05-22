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

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const s = SIZES[size];

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <img
        src="/icons/icon-192.png"
        alt="Conferly"
        className={`${s.icon} rounded-xl shadow-lg shadow-amber-500/20 object-cover`}
      />
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
