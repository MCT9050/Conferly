import { Suspense, lazy, useMemo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

function getRouteFromURL() {
  try {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const effectivePath = hash.startsWith('#/') ? hash.substring(1) : path;
    return effectivePath.replace('/', '');
  } catch (e) {}
  return 'none';
}

export default function App() {
  const [ready, setReady] = useState(false);
  
  // Safe mount - defer store usage
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  const initialRoute = useMemo(() => getRouteFromURL(), []);
  
  if (!ready) {
    return <RouteLoader />;
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <RouteLoader />
    </div>
  );
}
