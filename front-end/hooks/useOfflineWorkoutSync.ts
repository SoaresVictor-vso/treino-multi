'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { synchronizeAll, syncTrainerWorkoutList, warmTrainerCache } from '@/lib/offline-contingency';
import { getSessionUser } from '@/lib/auth';
import { Role } from '@/lib/roles';

const GENERAL_SYNC_INTERVAL_MS = 10 * 60_000;

export function useOfflineWorkoutSync(userId: string | undefined) {
  const pathname = usePathname();
  useEffect(() => {
    if (!userId) return;
    const synchronize = () => {
      if (navigator.onLine) void (getSessionUser()?.roles.includes(Role.TENANT_CLIENT)
        ? synchronizeAll(userId) : Promise.allSettled([warmTrainerCache(), syncTrainerWorkoutList(userId)]))
        .then(() => window.dispatchEvent(new Event('workout-status-changed')))
        .catch(() => undefined);
    };
    synchronize();
    const interval = window.setInterval(synchronize, GENERAL_SYNC_INTERVAL_MS);
    window.addEventListener('online', synchronize);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', synchronize);
    };
  }, [pathname, userId]);
}
