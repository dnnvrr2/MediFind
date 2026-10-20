import { useEffect, type PropsWithChildren } from 'react';
import { api } from '../api/client';
import { applyPharmacyCatalog } from '../data/catalog';
export function CatalogProvider({ children }: PropsWithChildren) {
  useEffect(() => { let live = true; const refresh = () => api.publicCatalog().then(value => { if (live) applyPharmacyCatalog(value); }).catch(() => undefined); void refresh(); const timer = setInterval(refresh, 20000); return () => { live = false; clearInterval(timer); }; }, []);
  return children;
}
