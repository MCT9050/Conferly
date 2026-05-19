import { useState, useCallback, useEffect } from 'react';
import { redirectToCheckout, checkPaymentReturn, isPeachConfigured, PLAN_PRICES_ZAR } from '../lib/peach';
import { trigger as automation } from '../lib/automation';
import type { PlanTier } from '../types';

export function usePayment(
  onUpgrade: (tier: PlanTier, cycle: 'monthly' | 'annual') => void,
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPaymentResult, setLastPaymentResult] = useState<{
    success: boolean; plan?: string; cycle?: string;
  } | null>(null);

  // On mount: check if returning from Peach redirect
  useEffect(() => {
    const result = checkPaymentReturn();
    if (result) {
      setLastPaymentResult(result);
      if (result.success && result.plan && result.cycle) {
        onUpgrade(result.plan as PlanTier, result.cycle as 'monthly' | 'annual');
        const price = PLAN_PRICES_ZAR[result.plan];
        const amount = price ? (result.cycle === 'annual' ? price.annual : price.monthly) : 0;
        automation('payment.completed', { data: { plan: result.plan, cycle: result.cycle, amountZar: amount, currency: 'ZAR' } });
        automation('plan.upgraded', { data: { plan: result.plan, cycle: result.cycle } });
      }
    }
  }, [onUpgrade]);

  const startCheckout = useCallback(async (
    planTier: string,
    billingCycle: 'monthly' | 'annual',
    userEmail: string,
    userName: string,
    userId: string,
    userCount: number = 1,
  ) => {
    setError(null);

    // No Peach credentials → demo mode (local-only upgrade)
    if (!isPeachConfigured) {
      onUpgrade(planTier as PlanTier, billingCycle);
      return;
    }

    setIsProcessing(true);

    try {
      // This creates a hidden form and submits it — browser navigates to Peach
      await redirectToCheckout({
        planTier, billingCycle, userEmail, userName, userId, userCount,
      });
      // Browser navigates away after form.submit() — code below won't run
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed. Please try again.');
      setIsProcessing(false);
    }
  }, [onUpgrade]);

  return {
    isProcessing,
    error,
    lastPaymentResult,
    isPeachConfigured,
    startCheckout,
    clearError: useCallback(() => setError(null), []),
    clearResult: useCallback(() => setLastPaymentResult(null), []),
    planPricesZAR: PLAN_PRICES_ZAR,
  };
}
