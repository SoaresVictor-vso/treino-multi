import type { MeasurementChartData } from '@/gateway/services/analysis';
import { RiPulseLine } from 'react-icons/ri';
import { iconRegistry } from '@/components/training/WorkoutMeasurements';

const format = (value: number | null, unit: string | null) => value === null ? 'Sem dados' :
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ''}`;

function daysFromStart(startDay: string, days: number) {
  const start = new Date(`${startDay}T12:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

export function MeasurementChart({ measurement, days, startDay }: { measurement: MeasurementChartData; days: number; startDay: string }) {
  const dates = daysFromStart(startDay, days);
  const values = new Map(measurement.currentPeriod.map((point) => [point.day, point.value]));
  const maximum = Math.max(1, ...measurement.currentPeriod.map((point) => point.value));
  const Icon = iconRegistry[measurement.icon ?? ''] ?? RiPulseLine;
  return <article className={`min-w-0 max-w-full rounded-xl border p-4 ${measurement.presentation?.containerClass ?? 'border-outline-variant bg-surface-container-low'}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-start gap-2"><Icon className={`mt-0.5 text-xl ${measurement.presentation?.iconClass ?? 'text-primary-fixed'}`} /><div><h3 className={`font-semibold ${measurement.presentation?.labelClass ?? ''}`}>{measurement.name}</h3><p className="text-xs text-on-surface-variant">Cada coluna representa um dia</p></div></div>
      <div className="text-right text-xs text-on-surface-variant"><p>Atual: {format(measurement.currentTotal, measurement.unit)}</p><p>Anterior: {format(measurement.previousTotal, measurement.unit)}</p></div>
    </div>
    <div className="mt-5 min-w-0 max-w-full overflow-x-auto pb-2">
      <div className="flex h-36 items-end gap-1 border-b border-outline-variant" style={{ minWidth: `${Math.max(0, days * 20)}px` }}>
        {dates.map((day) => {
          const value = values.get(day);
          return <div key={day} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" title={`${day}: ${value === undefined ? 'sem registro' : format(value, measurement.unit)}`}>
            {value !== undefined && <div className="w-full max-w-5 rounded-t bg-primary-fixed transition-opacity group-hover:opacity-75"
              style={{ height: value === 0 ? '3px' : `${Math.max(3, value / maximum * 100)}%` }} />}
            {value !== undefined && <span className="sr-only">{day}: {format(value, measurement.unit)}</span>}
          </div>;
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-on-surface-variant"><span>{dates[0].slice(5).replace('-', '/')}</span><span>{dates.at(-1)?.slice(5).replace('-', '/')}</span></div>
    </div>
  </article>;
}

export default function MeasurementCharts({ measurements, days, startDay }: { measurements: MeasurementChartData[]; days: number; startDay: string }) {
  return <section className="space-y-4"><div><p className="type-label-caps text-primary-fixed">Evolução temporal</p><h2 className="text-xl font-bold">Métricas do treino</h2></div>
    {measurements.length ? <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">{measurements.map((measurement) => <MeasurementChart key={measurement.measurementId} measurement={measurement} days={days} startDay={startDay} />)}</div> :
      <p className="rounded-xl border border-outline-variant bg-surface-container-low p-5 text-on-surface-variant">Nenhuma métrica registrada neste período.</p>}
  </section>;
}
