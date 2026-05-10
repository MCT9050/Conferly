import { Suspense, lazy, useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
  const s = useAppState(); // THIS LINE added
  
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
      <p>Store state: {s.view}</p>
    </div>
  );
}
