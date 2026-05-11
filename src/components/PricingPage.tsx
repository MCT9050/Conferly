import React, { useState, useEffect } from 'react';

interface PricingPageProps {
  setView: (v: string) => void;
  subscription: any;
  pricing: any;
  allLimits: any;
  onUpgrade: any;
}

export default function PricingPage({
  setView,
  subscription,
  pricing,
  allLimits,
  onUpgrade,
}: PricingPageProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      padding: '40px',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '30px', fontWeight: 'bold' }}>
        💰 PRICING
      </h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '1000px' }}>
        {/* Trial */}
        <div style={{ background: 'rgba(255,255,255,0.9)', color: '#333', padding: '30px', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Trial</h2>
          <p style={{ fontSize: '36px', fontWeight: 'bold' }}>FREE</p>
          <ul style={{ marginTop: '20px', lineHeight: '2' }}>
            <li>Up to 500 participants</li>
            <li>40 min max</li>
          </ul>
        </div>
        
        {/* Pro */}
        <div style={{ background: 'white', color: '#333', padding: '30px', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Pro</h2>
          <p style={{ fontSize: '36px', fontWeight: 'bold' }}>$15<span style={{ fontSize: '18px' }}>/mo</span></p>
          <ul style={{ marginTop: '20px', lineHeight: '2' }}>
            <li>Up to 500 participants</li>
            <li>Unlimited duration</li>
            <li>Recording + Transcription</li>
          </ul>
        </div>
        
        {/* Business */}
        <div style={{ background: 'white', color: '#333', padding: '30px', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Business</h2>
          <p style={{ fontSize: '36px', fontWeight: 'bold' }}>$35<span style={{ fontSize: '18px' }}>/mo</span></p>
          <ul style={{ marginTop: '20px', lineHeight: '2' }}>
            <li>Everything in Pro</li>
            <li>Analytics</li>
            <li>Priority Support</li>
          </ul>
        </div>
      </div>
      
      <button 
        onClick={() => setView('home')}
        style={{
          marginTop: '40px',
          padding: '15px 40px',
          fontSize: '18px',
          background: 'white',
          color: '#f97316',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        ← Back to Home
      </button>
    </div>
  );
}
