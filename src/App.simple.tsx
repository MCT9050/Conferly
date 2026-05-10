import { Suspense, lazy, useMemo } from 'react';
import { useAppState } from './store';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';

const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Lobby = lazy(() => import('./components/Lobby').then(m => ({ default: m.Lobby })));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

function getRouteFromURL() {
  try {
    const path = window?.location?.pathname || '';
    const hash = window?.location?.hash || '';
    const effectivePath = hash.startsWith('#/') ? hash.substring(1) : path.replace('/', '');
    return effectivePath;
  } catch (e) { return ''; }
}

export default function App() {
  const state = useAppState();
  const route = useMemo(() => getRouteFromURL(), []);
  const isInMeeting = state.view === 'meeting' && state.roomId;
  
  return (
    <Suspense fallback={<RouteLoader />}>
      {state.isAuthenticated ? (
        isInMeeting ? (
          <Lobby />
        ) : (
          <Dashboard />
        )
      ) : route === 'auth' ? (
        <AuthPage />
      ) : (
        <>
          <InstallBanner />
          <LandingPage />
        </>
      )}
    </Suspense>
  );
}
