import Link from "next/link";
import Logo from "../../components/Logo";

const plans = [
  { name: 'Starter', price: 'Free', description: 'Up to 5 participants, basic meetings, chat history, and team access.' },
  { name: 'Pro', price: 'R149 / month', description: 'Unlimited meetings, AI summaries, translation support, and attendee controls.' },
  { name: 'Enterprise', price: 'Custom', description: 'Advanced security, analytics, and premium support for organizations.' },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo size="sm" className="text-white" />
          <Link href="/" className="text-sm text-slate-300 transition hover:text-white">
            Back to home
          </Link>
        </header>

        <section className="mt-16 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-amber-400">Pricing</p>
          <h1 className="mt-4 text-4xl font-bold text-white">Choose the plan that fits your team.</h1>
          <p className="mt-4 max-w-2xl mx-auto text-slate-400">
            Conferly pricing is designed to help teams collaborate securely while keeping things simple and predictable.
          </p>
        </section>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map(plan => (
            <div key={plan.name} className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-left shadow-xl shadow-black/20">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-white">{plan.name}</h2>
                <span className="text-sm text-amber-300">{plan.price}</span>
              </div>
              <p className="mt-4 text-slate-400">{plan.description}</p>
              <div className="mt-8">
                <button className="w-full rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300">
                  Select
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-slate-300">
          <h2 className="text-xl font-semibold text-white">Need help choosing?</h2>
          <p className="mt-3">Reach out to our team for tailored recommendations, deployment planning, and enterprise onboarding.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300">
            View Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
