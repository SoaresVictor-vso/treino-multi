export type AnalysisDays = 7 | 15 | 30;
export type AnalysisPeriod = AnalysisDays | '3m';

export default function AnalysisPeriodFilter({ days, onChange, includeThreeMonths = false }: { days: AnalysisPeriod; onChange: (days: AnalysisPeriod) => void; includeThreeMonths?: boolean }) {
  const options: AnalysisPeriod[] = includeThreeMonths ? [7, 15, 30, '3m'] : [7, 15, 30];
  return <div className="inline-flex rounded-xl border border-outline-variant bg-surface-container-low p-1" role="group" aria-label="Período da análise">
    {options.map((value) => <button key={value} type="button" aria-pressed={days === value}
      onClick={() => onChange(value)}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${days === value ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-surface'}`}>
      {value === '3m' ? '3 meses' : `${value} dias`}
    </button>)}
  </div>;
}
