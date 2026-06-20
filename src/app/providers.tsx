'use client';

import { SessionProvider } from 'next-auth/react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCosmeticsState, type CosmeticsState } from '@/app/actions/cosmetics';
import { getCosmetic, DEFAULT_EQUIPPED, type EquippedCosmetics } from '@/lib/cosmetics';
import NativeBridge from '@/components/NativeBridge';
import RefreshOnFocus from '@/components/RefreshOnFocus';

interface CosmeticsContextValue {
  equipped: EquippedCosmetics;
  balance: number;
  ownedIds: string[];
  /** When true, the gem economy is off — everything is unlocked. */
  free: boolean;
  /** Re-fetch after a purchase/equip so the UI reflects the change app-wide. */
  refresh: () => Promise<void>;
}

const CosmeticsContext = createContext<CosmeticsContextValue>({
  equipped: DEFAULT_EQUIPPED,
  balance: 0,
  ownedIds: [],
  free: false,
  refresh: async () => {},
});

/** Read the active cosmetics (equipped ids, gem balance) from anywhere in the tree. */
export function useCosmetics(): CosmeticsContextValue {
  return useContext(CosmeticsContext);
}

function CosmeticsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CosmeticsState | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getCosmeticsState());
    } catch {
      /* unauthenticated or transient — fall back to defaults */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the live <html data-theme> in sync after the user changes their theme
  // (the initial value is rendered server-side in layout.tsx to avoid FOUC).
  const equipped = state?.equipped ?? DEFAULT_EQUIPPED;
  useEffect(() => {
    const attr = equipped.theme ? getCosmetic(equipped.theme)?.themeAttr : undefined;
    if (attr) document.documentElement.dataset.theme = attr;
    else delete document.documentElement.dataset.theme;
  }, [equipped.theme]);

  return (
    <CosmeticsContext.Provider
      value={{
        equipped,
        balance: state?.balance ?? 0,
        ownedIds: state?.ownedIds ?? [],
        free: state?.free ?? false,
        refresh,
      }}
    >
      {children}
    </CosmeticsContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CosmeticsProvider>
        <NativeBridge />
        <RefreshOnFocus />
        {children}
      </CosmeticsProvider>
    </SessionProvider>
  );
}
