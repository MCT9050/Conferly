/**
 * MINIMAL HASH ROUTER
 * Clean - no console noise
 */

import { useState, useEffect } from 'react';

type Route = 'home' | 'auth' | 'pricing';

const ROUTES: Record<string, Route> = {
  '': 'home',
  'home': 'home',
  'auth': 'auth',
  'pricing': 'pricing',
};

function getRouteFromHash(): Route {
  const hash = window.location?.hash || '';
  const path = hash.replace('#', '').replace('/', '').split('?')[0].split('#')[0];
  return ROUTES[path] || 'home';
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => getRouteFromHash());
  
  useEffect(() => {
    function onHashChange() {
      setRoute(getRouteFromHash());
    }
    
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  
  return route;
}

export function navigate(path: string) {
  window.location.hash = path;
}
