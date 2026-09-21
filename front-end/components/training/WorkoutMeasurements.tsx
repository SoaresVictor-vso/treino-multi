import {
	RiPulseLine,
	RiCheckboxCircleLine,
	RiDashboardLine,
	RiFocus3Line,
	RiTimerLine,
	RiWeightLine,
} from 'react-icons/ri';
import type { ComponentType } from 'react';
import type { WorkoutMeasurement } from '@/gateway/services/workouts';

// Kept as literals so Tailwind emits every class that can arrive from a persisted
// measurement presentation. Add new approved presentation classes here as well.
const presentationSafelist =
	'bg-surface-container-high border-outline-variant text-primary-fixed text-on-surface text-on-surface-variant';

const iconRegistry: Record<string, ComponentType<{ className?: string }>> = {
	timer: RiTimerLine,
	dumbbell: RiWeightLine,
	gauge: RiDashboardLine,
	activity: RiPulseLine,
	target: RiFocus3Line,
	'check-circle': RiCheckboxCircleLine,
};

function format(value: number, key: string) {
	if (key === 'duration') {
		const minutes = Math.floor(value / 60);
		const seconds = Math.round(value % 60);
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	if (key.includes('adherence')) return `${value.toFixed(0)}%`;
	if (key === 'average-pace') return `${value.toFixed(2)} s/m`;
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function WorkoutMeasurements({ measurements }: { measurements: WorkoutMeasurement[] }) {
	void presentationSafelist;
	if (!measurements.length) return null;
	return (
		<section className="space-y-3" aria-labelledby="workout-measurements-title">
			<div>
				<p className="type-label-caps text-primary-fixed">Resultado do treino</p>
				<h2 id="workout-measurements-title" className="text-xl font-bold">Suas métricas</h2>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{measurements.map((measurement, index) => {
					const Icon = iconRegistry[measurement.icon] ?? RiPulseLine;
					return (
						<article key={measurement.id} className={`rounded-xl border p-4 ${measurement.presentation.containerClass}`}>
							{index === 0 && <span className="mb-2 inline-block rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold text-on-primary-container">DESTAQUE</span>}
							<div className="flex items-center gap-3">
								<Icon className={`text-2xl ${measurement.presentation.iconClass}`} aria-hidden="true" />
								<div>
									<p className={`text-xs font-semibold ${measurement.presentation.labelClass}`}>{measurement.name}</p>
									<p className={`text-2xl font-bold ${measurement.presentation.valueClass}`}>{format(measurement.value, measurement.key)}</p>
								</div>
							</div>
						</article>
					);
				})}
			</div>
		</section>
	);
}
