import { useState } from 'react';
console.log('[PRICING] Module loaded - simple version');

interface PricingPageProps {
  setView: (v: string) => void;
  subscription: any;
  pricing: any;
  allLimits: any;
  onUpgrade: any;
}

export default function PricingPage({
  setView, subscription, pricing, allLimits, onUpgrade,
}: PricingPageProps) {
  console.log('[PRICING] SIMPLE Component executed!');
  return (
    <div style={{ minHeight: '100vh', background: 'cyan', padding: '40px' }}>
      <h1 style={{ fontSize: '40px', color: 'black' }}>SIMPLE PRICING WORKS!</h1>
    </div>
  );
}
