import type { MeasurementChartData } from '@/gateway/services/analysis';
import { RiPulseLine } from 'react-icons/ri';
import { iconRegistry } from '@/components/training/WorkoutMeasurements';
import MetricChart, { type MetricChartCategory } from './MetricChart';

const format = (value: number | null, unit: string | null) => {
  if (value === null) return 'Sem dados';
  if (unit === 's') {
    const totalSeconds = Math.round(value);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
    return `0:${String(seconds).padStart(2, '0')}`;
  }
  if (unit === 's/m') {
    const seconds = Math.round(value * 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min/km`;
  }
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ''}`;
};
function daysFromStart(startDay: string, days: number) {
  const start = new Date(`${startDay}T12:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

export function MeasurementChart({ measurement, days, startDay, previousStartDay }: { measurement: MeasurementChartData; days: number; startDay: string; previousStartDay: string }) {
  const dates = daysFromStart(startDay, days);
  const previousDates = daysFromStart(previousStartDay, days);
  const currentValues = new Map(measurement.currentPeriod.map((point) => [point.day, point.value]));
  const previousValues = new Map(measurement.previousPeriod.map((point) => [point.day, point.value]));
  const categories: MetricChartCategory[] = dates.map((day, offset) => {
    const previousDay = previousDates[offset];
    const current = currentValues.get(day);
    const previous = previousValues.get(previousDay);
    return {
      label: String(offset + 1),
      ...(current === undefined ? {} : { current: { date: day, value: current } }),
      ...(previous === undefined ? {} : { previous: { date: previousDay, value: previous } }),
    };
  });
  const isPace = measurement.unit === 's/m';
  const formatChartValue = (value: number) => format(value, measurement.unit);
  const Icon = iconRegistry[measurement.icon ?? ''] ?? RiPulseLine;
  return <article className={`min-w-0 max-w-full rounded-xl border p-4 ${measurement.presentation?.containerClass ?? 'border-outline-variant bg-surface-container-low'}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-start gap-2"><Icon className={`mt-0.5 text-xl ${measurement.presentation?.iconClass ?? 'text-primary-fixed'}`} /><div><h3 className={`font-semibold ${measurement.presentation?.labelClass ?? ''}`}>{measurement.name}</h3><p className="text-xs text-on-surface-variant">Cada coluna representa um dia</p></div></div>
      <div className="text-right text-xs text-on-surface-variant"><p>Atual: {format(measurement.currentTotal, measurement.unit)}</p><p>Anterior: {format(measurement.previousTotal, measurement.unit)}</p></div>
    </div>
    <MetricChart metric={measurement.name} categories={categories} unit={measurement.unit} pace={isPace} paceFactor={1000} minimumHeight={isPace ? 600 : undefined} formatValue={formatChartValue} />
  </article>;
}

export default function MeasurementCharts({ measurements, days, startDay, previousStartDay }: { measurements: MeasurementChartData[]; days: number; startDay: string; previousStartDay: string }) {
  return <section className="space-y-4"><div><p className="type-label-caps text-primary-fixed">Evolução temporal</p><h2 className="text-xl font-bold">Métricas do treino</h2></div>
    {measurements.length ? <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">{measurements.map((measurement) => <MeasurementChart key={measurement.measurementId} measurement={measurement} days={days} startDay={startDay} previousStartDay={previousStartDay} />)}</div> :
      <p className="rounded-xl border border-outline-variant bg-surface-container-low p-5 text-on-surface-variant">Nenhuma métrica registrada neste período.</p>}
  </section>;
}
