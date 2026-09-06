import AthleteHome from '@/components/athlete-app/AthleteHome';
import { getServerSessionUser } from '@/lib/auth.server';

export default async function AthleteAppHomePage() {
	const user = await getServerSessionUser();
	return <AthleteHome athleteName={user?.name} />;
}
