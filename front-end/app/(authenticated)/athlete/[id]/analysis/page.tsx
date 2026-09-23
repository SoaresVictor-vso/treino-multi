import AnalysisDashboard from '@/components/analysis/AnalysisDashboard';

export default async function AthleteAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalysisDashboard athleteId={id} showBack />;
}
