import { redirect } from 'next/navigation';
import AthleteAppShell from '@/components/athlete-app/AthleteAppShell';
import { getServerSessionUser } from '@/lib/auth.server';
import { isAthleteAppUser } from '@/lib/landing';

export default async function AthleteAppLayout({ children }: { children: React.ReactNode }) {
	const user = await getServerSessionUser();

	if (!user || !isAthleteAppUser(user.roles)) redirect('/unauthorized');

	return <AthleteAppShell>{children}</AthleteAppShell>;
}
