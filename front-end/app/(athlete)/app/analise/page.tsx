'use client';
import AnalysisDashboard from '@/components/analysis/AnalysisDashboard';
import { useSession } from '@/hooks/useSession';

export default function AnalisePage() {
	const user = useSession();
	if (!user) return null;
	return <AnalysisDashboard athleteId={user.sub} />;
}
