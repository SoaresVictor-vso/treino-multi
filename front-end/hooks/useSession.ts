'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken, getSessionUser, type SessionUser } from '@/lib/auth';
import { clearSessionTokens, hasStoredRefreshToken, refreshAccessToken, tokenHasEnoughLifetime } from '@/gateway/client';

/** Keeps this window's access token current; only remembered sessions can be restored after reload. */
export function useSession(): SessionUser | null {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    let mounted = true;
    const ensure = async () => {
      if (!tokenHasEnoughLifetime(getAuthToken())) {
        if (!hasStoredRefreshToken()) { if (mounted) router.replace('/login'); return; }
        const response = await refreshAccessToken();
        if (!response.success) {
          clearSessionTokens();
          if (mounted) router.replace('/login');
          return;
        }
      }
      if (mounted) setUser(getSessionUser());
    };
    void ensure();
    const interval = window.setInterval(() => void ensure(), 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void ensure(); };
    window.addEventListener('online', ensure);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener('online', ensure);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);
  return user;
}
