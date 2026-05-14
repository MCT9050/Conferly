import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavButtonsProps {
  showBack?: boolean;
  showHome?: boolean;
  className?: string;
}

export default function NavButtons({ showBack = true, showHome = true, className = '' }: NavButtonsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isAuth = location.pathname === '/auth';

  if (isHome) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showBack && !isHome && (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Go back"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </button>
      )}
      {showHome && !isHome && (
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
          title="Go to home"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="hidden sm:inline">Home</span>
        </button>
      )}
    </div>
  );
}