'use client';
import AuthenticatedShell from '@/components/AuthenticatedShell';
import { getAllowedRoles, getNavItemsForRoles } from '@/lib/navigation';
import { Role } from '@/lib/roles';
import { isAthleteAppUser } from '@/lib/landing';
import AthleteAppShell from '@/components/athlete-app/AthleteAppShell';
import { useSession } from '@/hooks/useSession';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = getAllowedRoles(pathname);
  const permitted = !!user && (!allowed || allowed.includes(Role.ALL) || allowed.some(role => user.roles.includes(role)));
  useEffect(() => { if (user && !permitted) router.replace('/unauthorized'); }, [user, permitted, router]);
  if (!permitted) return null;
  if (isAthleteAppUser(user.roles)) return <AthleteAppShell>{children}</AthleteAppShell>;
  return <AuthenticatedShell navItems={getNavItemsForRoles(user.roles)}
    canCreateExercise={user.roles.some(role => [Role.ORG_ADMIN, Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(role))}
    isGlobal={!user.tenantId}>{children}</AuthenticatedShell>;
}
