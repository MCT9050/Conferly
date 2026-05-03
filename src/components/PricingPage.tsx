import { useState } from 'react';
import {
  Check, X, ArrowLeft, Users, Clock, Video,
  Mic, Brain, Palette, HardDrive, ShieldCheck,
  BarChart3, Headphones, LayoutDashboard, Lock,
  DoorOpen, Crown, Zap, Building2, Globe,
  CreditCard, Loader2, AlertCircle, CheckCircle2
} from 'lucide-react';
import type { AppView, PlanTier, PlanLimits, Subscription } from '../types';
import Logo from './Logo';

interface PricingPageProps {
  setView: (v: AppView) => void;
  subscription: Subscription;
  pricing: Record<PlanTier, { monthly: number; annual: number }>;
  allLimits: Record<PlanTier, PlanLimits>;
  onUpgrade: (tier: PlanTier, cycle: 'monthly' | 'annual') => void;
  // Payment
  onStartCheckout?: (planTier: string, cycle: 'monthly' | 'annual') => void;
  paymentProcessing?: boolean;
  paymentError?: string | null;
  paymentResult?: { success: boolean; plan?: string } | null;
  isPeachConfigured?: boolean;
  planPricesZAR?: Record<string, { monthly: number; annual: number }>;
  clearPaymentError?: () => void;
  clearPaymentResult?: () => void;
}

const PLAN_META: Record<PlanTier, { name: string; tagline: string; icon: typeof Zap; color: string; gradient: string }> = {
  trial: { name: '14-Day Trial', tagline: 'Try everything free', icon: Zap, color: 'text-amber-400', gradient: 'from-amber-500 to-orange-400' },
  pro: { name: 'Pro', tagline: 'For small teams', icon: Crown, color: 'text-blue-400', gradient: 'from-blue-600 to-cyan-500' },
  business: { name: 'Business', tagline: 'For growing companies', icon: Building2, color: 'text-purple-400', gradient: 'from-purple-600 to-pink-500' },
  enterprise: { name: 'Enterprise', tagline: 'For large organizations', icon: Globe, color: 'text-amber-400', gradient: 'from-amber-500 to-orange-500' },
};

const FEATURE_ROWS: { key: keyof PlanLimits; label: string; icon: typeof Users; format?: (v: number | boolean) => string }[] = [
  { key: 'maxParticipants', label: 'Participants', icon: Users, format: v => v === 500 ? 'Up to 500' : `Up to ${v}` },
  { key: 'maxDurationMinutes', label: 'Meeting duration', icon: Clock, format: v => v === -1 ? 'Unlimited' : v === 40 ? '40 min' : `${Math.floor(Number(v) / 60)} hrs` },
  { key: 'recording', label: 'Meeting recording', icon: Video },
  { key: 'transcription', label: 'Live transcription', icon: Mic },
  { key: 'aiPulse', label: 'AI Meeting Pulse', icon: Brain },
  { key: 'waitingRoom', label: 'Waiting room', icon: DoorOpen },
  { key: 'meetingPassword', label: 'Meeting passwords', icon: Lock },
  { key: 'meetingLock', label: 'Meeting lock', icon: ShieldCheck },
  { key: 'cloudStorage', label: 'Cloud storage', icon: HardDrive },
  { key: 'customBranding', label: 'Custom branding', icon: Palette },
  { key: 'sso', label: 'SSO / SAML', icon: ShieldCheck },
  { key: 'analytics', label: 'Usage analytics', icon: BarChart3 },
  { key: 'adminDashboard', label: 'Admin dashboard', icon: LayoutDashboard },
  { key: 'prioritySupport', label: 'Priority support', icon: Headphones },
];

export default function PricingPage({
  setView, subscription, pricing, allLimits, onUpgrade,
  onStartCheckout, paymentProcessing, paymentError, paymentResult,
  isPeachConfigured: peachReady, planPricesZAR, clearPaymentError, clearPaymentResult,
}: PricingPageProps) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');
  const tiers: PlanTier[] = ['pro', 'business', 'enterprise'];

  const handleUpgrade = (tier: PlanTier) => {

    if (peachReady && onStartCheckout) {
      onStartCheckout(tier, cycle);
    } else {
      // Fallback: local-only upgrade (demo)
      onUpgrade(tier, cycle);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="glass sticky top-0 z-50 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('dashboard')} className="p-2 rounded-xl hover:bg-slate-800/60 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <Logo size="sm" />
          </div>
          <div className="text-sm text-slate-400">
            Current plan: <span className="text-white font-semibold">{PLAN_META[subscription.tier].name}</span>
          </div>
        </div>
      </div>

      {/* Payment status banners */}
      {paymentError && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-sm text-red-400 flex-1">{paymentError}</span>
            {clearPaymentError && <button onClick={clearPaymentError} className="text-xs text-red-300 underline">Dismiss</button>}
          </div>
        </div>
      )}
      {paymentResult?.success && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <span className="text-sm text-green-400 flex-1">Payment successful! Your plan has been upgraded.</span>
            {clearPaymentResult && <button onClick={clearPaymentResult} className="text-xs text-green-300 underline">Dismiss</button>}
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="text-center pt-16 pb-12 px-6">
        <h1 className="text-4xl lg:text-5xl font-extrabold mb-4">
          Plans for every <span className="text-gradient">team size</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
          Start free, upgrade when you need more. All plans include live video, chat, and collaborative notes.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 p-1.5 rounded-xl glass">
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
      </div>

      {/* Plan Cards */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {tiers.map(tier => {
            const meta = PLAN_META[tier];
            const limits = allLimits[tier];
            const price = pricing[tier];
            const isCurrent = subscription.tier === tier;
            const isPopular = tier === 'business';

            return (
              <div
                key={tier}
                className={`glass rounded-2xl overflow-hidden flex flex-col relative ${
                  isPopular ? 'ring-2 ring-purple-500/40 shadow-lg shadow-purple-500/10' : ''
                } ${isCurrent ? 'ring-2 ring-green-500/40' : ''}`}
              >
                {isPopular && (
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-center py-1.5 text-xs font-bold text-white">
                    Most Popular
                  </div>
                )}
                {isCurrent && !isPopular && (
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-center py-1.5 text-xs font-bold text-white">
                    Current Plan
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}>
                      <meta.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{meta.name}</h3>
                      <p className="text-xs text-slate-500">{meta.tagline}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {price[cycle] === 0 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold">$0</span>
                        <span className="text-slate-500 text-sm">forever</span>
                      </div>
                    ) : price[cycle] === -1 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold">Custom</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold">${price[cycle]}</span>
                        <span className="text-slate-500 text-sm">/user/{cycle === 'annual' ? 'mo' : 'month'}</span>
                      </div>
                    )}
                    {cycle === 'annual' && price.monthly > 0 && (
                      <p className="text-xs text-green-400 mt-1">
                        Save ${(price.monthly - price.annual) * 12}/yr per user
                      </p>
                    )}
                  </div>

                  {/* Key features */}
                  <div className="space-y-2.5 flex-1 mb-6">
                    <div className="text-xs text-slate-400 font-medium mb-3">Includes:</div>
                    {FEATURE_ROWS.slice(0, 8).map(row => {
                      const val = limits[row.key];
                      const enabled = typeof val === 'boolean' ? val : (val as number) > 0 || (val as number) === -1;
                      return (
                        <div key={row.key} className="flex items-center gap-2.5 text-sm">
                          {enabled ? (
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                          <span className={enabled ? 'text-slate-300' : 'text-slate-600'}>
                            {row.format && typeof val === 'number' ? row.format(val) : row.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* ZAR price (if available) */}
                  {planPricesZAR && planPricesZAR[tier] && planPricesZAR[tier][cycle] > 0 && (
                    <div className="text-xs text-slate-500 mb-3">
                      ZAR R{planPricesZAR[tier][cycle]}/user/{cycle === 'annual' ? 'mo' : 'month'}
                    </div>
                  )}

                  {/* CTA */}
                  {isCurrent ? (
                    <button disabled className="w-full py-3 min-h-[44px] rounded-xl bg-slate-700/40 text-slate-500 font-medium text-sm cursor-not-allowed">
                      Current Plan
                    </button>
                  ) : tier === 'enterprise' ? (
                    <button className="w-full py-3 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm active:opacity-80 transition-all">
                      Contact Sales
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(tier)}
                      disabled={paymentProcessing}
                      className={`w-full py-3 min-h-[44px] rounded-xl bg-gradient-to-r ${meta.gradient} text-white font-semibold text-sm active:opacity-80 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                      {paymentProcessing ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                      ) : peachReady ? (
                        <><CreditCard className="w-4 h-4" />Pay & Upgrade to {meta.name}</>
                      ) : (
                        <>Upgrade to {meta.name}</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Full comparison table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-800/50">
            <h2 className="text-xl font-bold">Full Feature Comparison</h2>
            <p className="text-sm text-slate-400 mt-1">Every feature, every plan — side by side</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/50">
                  <th className="text-left px-6 py-4 text-slate-400 font-medium w-64">Feature</th>
                  {tiers.map(t => (
                    <th key={t} className="text-center px-4 py-4 font-semibold">
                      <span className={PLAN_META[t].color}>{PLAN_META[t].name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map(row => (
                  <tr key={row.key} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-3.5 flex items-center gap-2.5 text-slate-300">
                      <row.icon className="w-4 h-4 text-slate-500 shrink-0" />
                      {row.label}
                    </td>
                    {tiers.map(t => {
                      const val = allLimits[t][row.key];
                      if (typeof val === 'boolean') {
                        return (
                          <td key={t} className="text-center px-4 py-3.5">
                            {val ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-slate-700 mx-auto" />}
                          </td>
                        );
                      }
                      const numVal = val as number;
                      const display = row.format ? row.format(numVal) : numVal === -1 ? 'Unlimited' : `${numVal}`;
                      return (
                        <td key={t} className="text-center px-4 py-3.5 text-slate-300 text-xs">
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Storage row */}
                <tr className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-3.5 flex items-center gap-2.5 text-slate-300">
                    <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
                    Storage
                  </td>
                  {tiers.map(t => {
                    const gb = allLimits[t].storageLimitGb;
                    return (
                      <td key={t} className="text-center px-4 py-3.5 text-slate-300 text-xs">
                        {gb === 0 ? <X className="w-4 h-4 text-slate-700 mx-auto" /> : gb === -1 ? 'Unlimited' : `${gb} GB`}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-12 glass rounded-2xl p-8 lg:p-12 text-center">
          <div className="max-w-2xl mx-auto space-y-4">
            <Building2 className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-3xl font-bold">Need Enterprise?</h2>
            <p className="text-slate-400 leading-relaxed">
              Unlimited participants, custom SLAs, dedicated support, on-premise deployment, 
              SSO/SAML, advanced compliance, and volume licensing for organizations with 50+ users.
            </p>
            <button className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg">
              Talk to Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
