"use client";

import { useCallback, useState } from 'react';

interface CheckoutButtonProps {
  planId: string;
  cta: string;
  color: string;
  productType: 'meet' | 'class';
  isEnterprise?: boolean;
  enterpriseEmail?: string;
}

export default function CheckoutButton({ 
  planId, 
  cta, 
  color, 
  productType,
  isEnterprise = false,
  enterpriseEmail = 'sales@conferly.app'
}: CheckoutButtonProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (isEnterprise) {
      window.open(`mailto:${enterpriseEmail}`, '_blank');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      let result: { error?: string; url?: string };
      
      if (productType === 'meet') {
        const { createMeetCheckout } = await import('../../app/actions/checkout-actions');
        result = await createMeetCheckout(planId as any);
      } else {
        const { createClassCheckout } = await import('../../app/actions/checkout-actions');
        result = await createClassCheckout(planId as any);
      }
      
      if (result.error) {
        setError(result.error);
        setProcessing(false);
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      setProcessing(false);
    }
  }, [planId, productType, isEnterprise, enterpriseEmail]);

  return (
    <>
      <button
        onClick={handleClick}
        disabled={processing}
        className={`w-full py-3 min-h-[44px] rounded-xl bg-gradient-to-r ${color} text-white font-semibold text-sm active:opacity-80 transition-all shadow-lg disabled:opacity-50`}
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Redirecting…
          </span>
        ) : (
          cta
        )}
      </button>
      {error && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </>
  );
}