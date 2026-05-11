import { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { useAppState } from './store';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';

const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Lobby = lazy(() => import('./components/Lobby').then(m => ({ default: m.Lobby })));
const MeetingRoom = lazy(() => import('./components/MeetingRoom').then(m => ({ default: m.MeetingRoom })));
const PricingPage = lazy(() => import('./components/PricingPage').then(m => ({ default: m.PricingPage })));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

export default function App() {
  const state = useAppState();
  const [route, setRoute] = useState('');
  
  useEffect(() => {
    const getRoute = () => {
      const hash = window?.location?.hash || '';
      const r = hash.replace('#/', '').replace('#', '');
      setRoute(r);
    };
    getRoute();
    window.addEventListener('hashchange', getRoute);
    return () => window.removeEventListener('hashchange', getRoute);
  }, []);
  
  const isInMeeting = state.view === 'meeting' && state.roomId;
  
  // Simple routing - ONLY lazy components
  return (
    <Suspense fallback={<RouteLoader />}>
      {state.isAuthenticated ? (
        isInMeeting ? <MeetingRoom /> : <Lobby />
      ) : route === 'auth' ? (
        <AuthPage />
      ) : route === 'pricing' ? (
        <PricingPage />
      ) : (
        <>
          <InstallBanner />
          <LandingPage />
        </>
      )}
    </Suspense>
  );
}
