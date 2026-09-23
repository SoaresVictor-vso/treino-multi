import type { AnalysisIndicators as Indicators } from '@/gateway/services/analysis';
import CircularMetric from './CircularMetric';

export default function AnalysisIndicators({ indicators }: { indicators: Indicators }) {
  return <div className="grid gap-3 md:grid-cols-3">
    <CircularMetric label="RPE médio" metric={indicators.averageRpe} kind="rpe" />
    <CircularMetric label="Adesão ao treino" metric={indicators.adherence} kind="percent" />
    <CircularMetric label="Adesão de RPE" metric={indicators.rpeAdherence} kind="percent" />
  </div>;
}
