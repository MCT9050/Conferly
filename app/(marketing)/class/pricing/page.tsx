import BillingCycleToggle from "../../../../components/marketing/BillingCycleToggle";
import CheckoutButton from "../../../../components/marketing/CheckoutButton";
import Link from "next/link";
import Logo from "../../../../components/Logo";
import { CLASS_PLANS, type ClassPlanId } from "../../../../lib/pricing/class";

export const revalidate = 86400; // ISR: revalidate daily

export const metadata = {
  title: "Conferly Class Pricing — Tutoring Plans Starting at R89/mo",
  description: "Choose the perfect plan for your tutoring business. Free trial, no credit card required.",
};

const PLAN_ICONS: Record<string, string> = {
  class_free: "Users",
  class_room: "BookOpen",
  class_room_plus: "GraduationCap",
  class_unlimited: "ShieldCheck",
};

const PLAN_COLORS: Record<string, string> = {
  class_free: "from-slate-500 to-slate-400",
  class_room: "from-emerald-600 to-teal-500",
  class_room_plus: "from-emerald-700 to-teal-600",
  class_unlimited: "from-purple-600 to-pink-500",
};

export default function ClassPricingPage() {
  const visiblePlans = CLASS_PLANS.filter(p => p.id !== 'class_free');

  return (
    <div className="min-h-screen pb-20 bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/class" className="p-2 rounded-xl hover:bg-slate-800/60 transition-colors">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
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

      {/* Hero */}
      <div className="text-center pt-16 pb-12 px-6">
        <h1 className="text-4xl lg:text-5xl font-extrabold mb-4">
          The complete classroom for <span className="text-emerald-400">tutors and trainers</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
          For tutors, coaches, and training businesses. Whiteboard, lesson plans, student rosters, assignments, and payments.
        </p>

        <BillingCycleToggle defaultCycle="annual" />
      </div>

      {/* Plan Cards */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {visiblePlans.map(plan => {
            const Icon = PLAN_ICONS[plan.id] || "BookOpen";
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
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{plan.name}</h3>
                      <p className="text-xs text-slate-500">{plan.description}</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1">
                    {plan.annualPrice === null ? (
                      <span className="text-4xl font-extrabold text-white">Custom</span>
                    ) : (
                      <>
                        <span className="text-4xl font-extrabold text-white">R{plan.annualPrice}</span>
                        <span className="text-slate-500 text-sm">/user/month</span>
                      </>
                    )}
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-sm">
                        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-slate-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <CheckoutButton
                    planId={plan.id}
                    cta={plan.cta}
                    color={color}
                    productType="class"
                    isEnterprise={plan.id === 'class_unlimited'}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise CTA */}
        <div className="rounded-2xl p-8 lg:p-12 text-center bg-slate-900/60 border border-slate-800/50">
          <div className="max-w-2xl mx-auto space-y-4">
            <svg className="w-12 h-12 text-amber-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="text-3xl font-bold text-white">Need an Institutional Plan?</h2>
            <p className="text-slate-400 leading-relaxed">
              Unlimited classrooms, white-label branding, API access, dedicated success manager, 
              and custom integrations for schools and training organizations.
            </p>
            <a 
              href="mailto:sales@conferly.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}