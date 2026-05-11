/**
 * MINIMAL HASH ROUTER
 * No Suspense, no lazy imports, no forceUpdate
 */

import { useState, useEffect } from 'react';

type Route = 'home' | 'auth' | 'pricing';

const ROUTES: Record<string, Route> = {
  '': 'home',
  'home': 'home',
  'auth': 'auth',
  'pricing': 'pricing',
};

// Get route from hash - straightforward
function getRouteFromHash(): Route {
  const hash = window.location?.hash || '';
  const path = hash.replace('#/', '').split('?')[0].split('#')[0];
  return ROUTES[path] || 'home';
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => getRouteFromHash());
  
  // Simple hashchange listener
  useEffect(() => {
    function onHashChange() {
      console.log('[ROUTER] hashchange event, hash:', window.location.hash);
      const newRoute = getRouteFromHash();
      console.log('[ROUTER] parsed to:', newRoute);
      setRoute(newRoute);
    }
    
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  
  console.log('[ROUTER] useHashRoute returning:', route);
  return route;
}

export function navigate(path: string) {
  console.log('[ROUTER] navigating to:', path);
  window.location.hash = path;
}
