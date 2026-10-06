'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { apiUrl } from '@/lib/api/client';
import { useApi } from '@/lib/api/useApi';
import { applyBrandColor } from '@/lib/theme';

export const DEFAULT_APP_NAME = 'Blue';

export interface Branding {
  appName: string | null;
  color: string | null;
  logoUrl: string | null;
}

interface BrandingValue {
  appName: string;
  // Absolute, ready for an <img>; null shows the default mark
  logoSrc: string | null;
  branding: Branding | undefined;
  reload: () => void;
}

const BrandingContext = createContext<BrandingValue>({ appName: DEFAULT_APP_NAME, logoSrc: null, branding: undefined, reload: () => {} });

export const useBranding = () => useContext(BrandingContext);

// Keeps "Page · Blue" in the browser tab saying the institution's name instead, whenever Next sets a title
function useTabTitle(appName: string) {
  useEffect(() => {
    if (appName === DEFAULT_APP_NAME) return;
    const rename = () => {
      const suffix = ` · ${DEFAULT_APP_NAME}`;
      if (document.title.endsWith(suffix)) document.title = `${document.title.slice(0, -suffix.length)} · ${appName}`;
      else if (document.title === DEFAULT_APP_NAME) document.title = appName;
    };
    rename();
    const observer = new MutationObserver(rename);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [appName]);
}

// The signed-in institution's own name, logo and color. Only inside the dashboard: before sign-in everyone sees
// the default look. Leaving (signing out) puts the default color back.
export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const response = useApi<Branding>(user?.schoolId ? '/api/schools/branding' : null);
  const branding = response.data;

  useEffect(() => {
    applyBrandColor(branding?.color ?? null);
    return () => applyBrandColor(null);
  }, [branding?.color]);

  const appName = branding?.appName ?? DEFAULT_APP_NAME;
  useTabTitle(appName);

  const value = useMemo(
    () => ({ appName, logoSrc: branding?.logoUrl ? apiUrl(branding.logoUrl) : null, branding, reload: response.reload }),
    [appName, branding, response.reload],
  );
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}
