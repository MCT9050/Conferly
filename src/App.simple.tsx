import { Suspense, lazy, useMemo, useEffect, useState } from 'react';
import { useAppState } from './store';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  
  // Only use store in effect
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  const state = useAppState();
  
  if (!ready) {
    return <RouteLoader />;
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <RouteLoader />
      <p>Auth: {state.isAuthenticated ? 'yes' : 'no'}</p>
    </div>
  );
}
