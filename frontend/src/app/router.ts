import { useCallback, useEffect, useState } from 'react';

export type AppRoute =
  | { name: 'home' }
  | { name: 'library' }
  | { name: 'asset'; assetId: string }
  | { name: 'search' }
  | { name: 'settings' };

function getCurrentHash(): string {
  if (typeof window === 'undefined') {
    return '#/';
  }

  return window.location.hash || '#/';
}

export function parseRoute(hash: string): AppRoute {
  const normalizedPath = hash.replace(/^#/, '') || '/';
  const path = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'library') {
    return { name: 'library' };
  }

  if (segments[0] === 'search') {
    return { name: 'search' };
  }

  if (segments[0] === 'settings') {
    return { name: 'settings' };
  }

  if (segments[0] === 'assets' && segments[1]) {
    return { name: 'asset', assetId: decodeURIComponent(segments[1]) };
  }

  return { name: 'home' };
}

export function routeToHash(route: AppRoute): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'library':
      return '#/library';
    case 'search':
      return '#/search';
    case 'settings':
      return '#/settings';
    case 'asset':
      return `#/assets/${encodeURIComponent(route.assetId)}`;
    default:
      return '#/';
  }
}

export function useHashRoute(): [AppRoute, (route: AppRoute) => void] {
  const [route, setRoute] = useState<AppRoute>(() => parseRoute(getCurrentHash()));

  useEffect(() => {
    function handleHashChange() {
      setRoute(parseRoute(getCurrentHash()));
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute) => {
    const nextHash = routeToHash(nextRoute);

    if (typeof window === 'undefined') {
      setRoute(nextRoute);
      return;
    }

    if (window.location.hash === nextHash) {
      setRoute(nextRoute);
      return;
    }

    window.location.hash = nextHash;
  }, []);

  return [route, navigate];
}
