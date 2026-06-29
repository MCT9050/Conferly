"use client";

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Check, ArrowLeft, BookOpen, Users, GraduationCap, ShieldCheck, Loader2, AlertCircle, ClipboardList, FileText, DollarSign, BarChart3 } from 'lucide-react';
import { CLASS_PLANS, type ClassPlanId } from '../../../../lib/pricing/class';
import Logo from '../../../../components/Logo';

type ClassPlan = (typeof CLASS_PLANS)[number];

const PLAN_ICONS: Record<string, typeof BookOpen> = {
  class_free: Users,
  class_room: BookOpen,
  class_room_plus: GraduationCap,
  class_unlimited: ShieldCheck,
};

const PLAN_COLORS: Record<string, string> = {
  class_free: 'from-slate-500 to-slate-400',
  class_room: 'from-emerald-600 to-teal-500',
  class_room_plus: 'from-emerald-700 to-teal-600',
  class_unlimited: 'from-purple-600 to-pink-500',
};

export default function ClassPricingPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleUpgrade = useCallback(async (plan: ClassPlan) => {
    if (plan.id === 'class_unlimited') {
      window.open('mailto:sales@conferly.app', '_blank');
      return;
    }

    setProcessingTier(plan.id);
    setPaymentError(null);

    try {
      const { createClassCheckout } = await import('../../../actions/checkout-actions');
      const result = await createClassCheckout(plan.id as ClassPlanId);
      if (result.error) {
        setPaymentError(result.error);
        setProcessingTier(null);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      setProcessingTier(null);
    }
  }, []);

  const visiblePlans = CLASS_PLANS.filter(p => p.id !== 'class_free');

  return (
    <div className="min-h-screen pb-20 bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/class" className="p-2 rounded-xl hover:bg-slate-800/60 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">
              Conferly Meet →
            </Link>
          </div>
        </div>
      </div>

      {/* Payment error banner */}
      {paymentError && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-sm text-red-400 flex-1">{paymentError}</span>
            <button onClick={() => setPaymentError(null)} className="text-xs text-red-300 underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="text-center pt-16 pb-12 px-6">
        <h1 className="text-4xl lg:text-5xl font-extrabold mb-4">
          The complete classroom for <span className="text-emerald-400">tutors and trainers</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
          For tutors, coaches, and training businesses. Whiteboard, lesson plans, student rosters, assignments, and payments.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              cycle === 'monthly' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle('annual')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all relative ${
              cycle === 'annual' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
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
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {visiblePlans.map(plan => {
            const price = cycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
            const Icon = PLAN_ICONS[plan.id] || BookOpen;
            const color = PLAN_COLORS[plan.id] || 'from-emerald-600 to-teal-500';

            return (
              <div
                key={plan.id}
                className={`rounded-2xl overflow-hidden flex flex-col relative p-6 bg-slate-900/60 border ${
                  plan.popular ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'border-slate-800/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-600 to-teal-600 px-3 py-1 text-[10px] font-bold text-white rounded-bl-lg">
                    POPULAR
                  </div>
                )}

                <div className="flex-1 flex flex-col space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{plan.name}</h3>
                      <p className="text-xs text-slate-500">{plan.description}</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1">
                    {price === null ? (
                      <span className="text-4xl font-extrabold text-white">Custom</span>
                    ) : (
                      <>
                        <span className="text-4xl font-extrabold text-white">R{price}</span>
                        <span className="text-slate-500 text-sm">/user/month</span>
                      </>
                    )}
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-slate-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={processingTier === plan.id}
                    className={`w-full py-3 min-h-[44px] rounded-xl bg-gradient-to-r ${color} text-white font-semibold text-sm active:opacity-80 transition-all shadow-lg disabled:opacity-50`}
                  >
                    {processingTier === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting…
                      </span>
                    ) : (
                      plan.cta
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise CTA */}
        <div className="rounded-2xl p-8 lg:p-12 text-center bg-slate-900/60 border border-slate-800/50">
          <div className="max-w-2xl mx-auto space-y-4">
            <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-3xl font-bold text-white">Need an Institutional Plan?</h2>
            <p className="text-slate-400 leading-relaxed">
              Unlimited classrooms, white-label branding, API access, dedicated success manager, 
              and custom integrations for schools and training organizations.
            </p>
            <button 
              onClick={() => window.open('mailto:sales@conferly.app', '_blank')}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}