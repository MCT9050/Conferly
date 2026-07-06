import BillingCycleToggle from "../../../components/marketing/BillingCycleToggle";
import CheckoutButton from "../../../components/marketing/CheckoutButton";
import Link from "next/link";
import Logo from "../../../components/Logo";
import { MEET_PLANS, type MeetPlanId } from "../../../lib/pricing/meet";

export const revalidate = 86400; // ISR: revalidate daily

export const metadata = {
  title: "Conferly Meet Pricing — Professional Video Meetings",
  description: "Professional video meetings for consultants, agencies, and remote teams. Start free.",
};

const PLAN_ICONS: Record<string, string> = {
  meet_free: "Video",
  meet_individual: "Users",
  meet_pro: "Crown",
  meet_unlimited: "Crown",
  meet_enterprise: "ShieldCheck",
};

const PLAN_COLORS: Record<string, string> = {
  meet_free: "from-slate-500 to-slate-400",
  meet_individual: "from-cyan-500 to-sky-400",
  meet_pro: "from-blue-600 to-cyan-500",
  meet_unlimited: "from-purple-600 to-pink-500",
  meet_enterprise: "from-amber-500 to-orange-500",
};

const FEATURE_SECTIONS = [
  { label: 'Participants', key: 'maxParticipants' as const, format: (v: number) => v === 0 ? 'Unlimited' : `Up to ${v}` },
  { label: 'Meeting duration', key: 'maxDurationMinutes' as const, format: (v: number) => v === 0 ? 'Unlimited' : v === 40 ? '40 min' : `${v} min` },
  { label: 'Features', key: 'features' as const, format: (v: string[]) => `${v.length} included` },
];

export default function MeetPricingPage() {
  const visiblePlans = MEET_PLANS.filter(p => p.id !== 'meet_free');

  return (
    <div className="min-h-screen pb-20 bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl hover:bg-slate-800/60 transition-colors">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/class/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">
              Conferly Class →
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="text-center pt-16 pb-12 px-6">
        <h1 className="text-4xl lg:text-5xl font-extrabold mb-4">
          Professional video meetings <span className="text-blue-400">that just work</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
          For consultants, agencies, and remote teams. Start free, upgrade when you need more.
        </p>

        <BillingCycleToggle defaultCycle="annual" />
      </div>

      {/* Plan Cards */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {visiblePlans.map(plan => {
            const color = PLAN_COLORS[plan.id] || 'from-blue-600 to-cyan-500';

            return (
              <div
                key={plan.id}
                className={`rounded-2xl overflow-hidden flex flex-col relative p-6 bg-slate-900/60 border ${
                  plan.popular ? 'border-blue-500/40 shadow-lg shadow-blue-500/10' : 'border-slate-800/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-600 to-cyan-600 px-3 py-1 text-[10px] font-bold text-white rounded-bl-lg">
                    POPULAR
                  </div>
                )}

                <div className="flex-1 flex flex-col space-y-4">
                  <div>
                    <h3 className="font-bold text-lg text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-500">{plan.description}</p>
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

                  <div className="space-y-2 flex-1">
                    {FEATURE_SECTIONS.map(section => (
                      <div key={section.key} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{section.label}</span>
                        <span className="text-slate-300 font-medium">{section.format(plan[section.key] as any)}</span>
                      </div>
                    ))}
                  </div>

                  <CheckoutButton
                    planId={plan.id}
                    cta={plan.cta}
                    color={color}
                    productType="meet"
                    isEnterprise={plan.id === 'meet_enterprise'}
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
            <h2 className="text-3xl font-bold text-white">Need Enterprise?</h2>
            <p className="text-slate-400 leading-relaxed">
              Unlimited participants, custom SLAs, dedicated support, SSO/SAML, 
              advanced compliance, and volume licensing for organizations with 50+ users.
            </p>
            <a 
              href="mailto:sales@conferly.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg"
            >
              Talk to Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}