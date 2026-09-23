import AnalysisDashboard from '@/components/analysis/AnalysisDashboard';
import { getServerSessionUser } from '@/lib/auth.server';

export default async function AnalisePage() {
	const user = await getServerSessionUser();
	if (!user) return null;
	return <AnalysisDashboard athleteId={user.sub} />;
}
