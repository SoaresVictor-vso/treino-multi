'use client';
import AthleteAppShell from '@/components/athlete-app/AthleteAppShell';
import { useSession } from '@/hooks/useSession';
import { isAthleteAppUser } from '@/lib/landing';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AthleteAppLayout({ children }: { children: React.ReactNode }) {
  const user = useSession();
  const router = useRouter();
  useEffect(() => { if (user && !isAthleteAppUser(user.roles)) router.replace('/unauthorized'); }, [user, router]);
  return user && isAthleteAppUser(user.roles) ? <AthleteAppShell>{children}</AthleteAppShell> : null;
}
