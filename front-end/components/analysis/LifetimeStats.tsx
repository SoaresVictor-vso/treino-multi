import type { LifetimeStats as Stats } from '@/gateway/services/analysis';

const format = (value: number | null, unit = '') => value === null ? '—' :
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${unit}`;

export default function LifetimeStats({ stats, exercise = false }: { stats: Stats | (Omit<Stats, 'totalRepetitions'> & { totalRepetitions: number | null }); exercise?: boolean }) {
  const items = [
    ...(!exercise || stats.totalTonnage !== null ? [{ label: 'Tonelagem total', value: format(stats.totalTonnage, ' kg') }] : []),
    { label: exercise ? 'Treinos com o exercício' : 'Treinos realizados', value: format(stats.totalWorkouts) },
    ...(stats.totalRepetitions !== null ? [{ label: 'Repetições realizadas', value: format(stats.totalRepetitions) }] : []),
    { label: 'Séries realizadas', value: format(stats.totalSets) },
  ];
  return <section className="border-t border-outline-variant pt-7"><p className="type-label-caps text-primary-fixed">Desde o início</p><h2 className="mt-1 text-xl font-bold">Estatísticas gerais</h2>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <div key={item.label} className="rounded-xl border border-outline-variant bg-surface-container-low p-4"><p className="text-sm text-on-surface-variant">{item.label}</p><strong className="mt-2 block text-2xl">{item.value}</strong></div>)}</div>
  </section>;
}
