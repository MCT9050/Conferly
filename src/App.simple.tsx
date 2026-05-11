import { Suspense, lazy, useMemo, useState, useEffect } from 'react';
//import { useAppState } from './store';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';

const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

export default function App() {
  // NO store - just pure UI
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
  
  return (
    <Suspense fallback={<RouteLoader />}>
      {route === 'auth' ? <AuthPage /> : (
        <>
          <InstallBanner />
          <LandingPage />
        </>
      )}
    </Suspense>
  );
}
