import { Suspense, lazy, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';

// Simple test - just store hook
const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <RouteLoader />;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Conferly App</h1>
      <p>Store hook test...</p>
    </div>
  );
}
