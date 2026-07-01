"use client";

import { useState } from 'react';

interface BillingCycleToggleProps {
  defaultCycle?: 'monthly' | 'annual';
}

export default function BillingCycleToggle({ defaultCycle = 'annual' }: BillingCycleToggleProps) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>(defaultCycle);

  return (
    <div className="inline-flex items-center gap-3 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
      <button
        onClick={() => setCycle('monthly')}
        className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
          cycle === 'monthly' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => setCycle('annual')}
        className={`px-5 py-2 rounded-lg text-sm font-medium transition-all relative ${
          cycle === 'annual' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
        }`}
      >
        Annual
        <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-green-500 text-[9px] text-white font-bold">
          -20%
        </span>
      </button>
    </div>
  );
}