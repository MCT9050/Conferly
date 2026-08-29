// components/platform/FreeTierStatusPanel.tsx
// Phase C: server-rendered Universal Registered Free Tier status.
//
// All displayed values come from get_free_usage_status (the Phase B database
// RPC) via the existing lib/freeTier.ts wrapper — the browser never computes
// remaining minutes, usage days, eligibility, or paid status. The panel
// re-renders on every server navigation, so status stays accurate after
// sessions complete or the page is refreshed.

import Link from 'next/link';
import { getFreeTierStatus } from '@/lib/freeTier';

const PRODUCT_LABEL: Record<'meet' | 'class', string> = {
  meet: 'Meet',
  class: 'Class',
};

function FreeProductCard({ productLine }: { productLine: 'meet' | 'class' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <p className="text-sm font-medium text-white">{PRODUCT_LABEL[productLine]}</p>
      <FreeTierStatusLines productLine={productLine} />
    </div>
  );
}

async function FreeTierStatusLines({ productLine }: { productLine: 'meet' | 'class' }) {
  const status = await getFreeTierStatus(productLine);

  // A failed status read is never rendered as free success — the fail-closed
  // decision happens at the access points; here we simply show a neutral line.
  if (!status) {
    return (
      <p className="text-xs text-slate-400">Availability is being verified…</p>
    );
  }

  if (status.status === 'paid') {
    return (
      <>
        <p className="text-xs text-emerald-300">Paid plan active</p>
        <p className="text-xs text-slate-400">Unlimited access with your subscription.</p>
      </>
    );
  }

  if (status.status === 'anonymous') {
    return (
      <>
        <p className="text-xs text-amber-300">Registration required</p>
        <Link href="/auth" className="text-xs text-slate-300 underline hover:text-white">
          Sign in or register to use the free tier
        </Link>
      </>
    );
  }

  if (status.status !== 'free') {
    return <p className="text-xs text-slate-400">Not available for this product.</p>;
  }

  if (status.exhausted || (status.minutesRemainingToday ?? 0) <= 0) {
    return (
      <>
        <p className="text-xs text-amber-300">Free time used up</p>
        <p className="text-xs text-slate-400">
          Free day {Math.min(status.eligibleDaysUsed, 3)} of 3 used — upgrade to continue.
        </p>
        <Link href="/pricing" className="text-xs text-amber-400 underline hover:text-amber-300">
          Upgrade
        </Link>
      </>
    );
  }

  const currentDay = Math.min(
    status.eligibleDaysUsed + ((status.minutesUsedToday ?? 0) > 0 ? 0 : 1),
    3
  );
  return (
    <>
      <p className="text-xs text-emerald-300">Free available</p>
      <p className="text-xs text-slate-400">
        {status.minutesRemainingToday ?? 0} minutes remaining today · free day {currentDay} of 3
      </p>
    </>
  );
}

export default function FreeTierStatusPanel() {
  return (
    <section aria-label="Free plan availability" className="mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Your free plan
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <FreeProductCard productLine="meet" />
        <FreeProductCard productLine="class" />
      </div>
    </section>
  );
}
