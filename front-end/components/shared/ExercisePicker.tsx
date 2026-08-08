'use client';

import { useEffect, useMemo, useState } from 'react';
import { RiCheckLine, RiCloseLine, RiHeartPulseLine } from 'react-icons/ri';
import {
	ParametersService,
	type ExerciseParameter,
} from '@/api/services/parametro';
import Button from '@/components/ui/Button';
import {
	MetricFieldType,
	type Exercise,
	type Metric,
} from '@/api/services/parametro';

const metricByName: Record<string, MetricFieldType> = {
	repeticoes: MetricFieldType.INT,
	repetição: MetricFieldType.INT,
	repetition: MetricFieldType.INT,
	peso: MetricFieldType.DECIMAL,
	weight: MetricFieldType.DECIMAL,
	tempo: MetricFieldType.TIME,
	time: MetricFieldType.TIME,
	distancia: MetricFieldType.DECIMAL,
	distância: MetricFieldType.DECIMAL,
	distance: MetricFieldType.DECIMAL,
	ritmo: MetricFieldType.DECIMAL,
	pace: MetricFieldType.DECIMAL,
};

function toExercise(
	exercise: ExerciseParameter,
	metrics: Record<string, Metric>,
): Exercise {
	const metric_1 = metrics[exercise.metric1Id];
	const metric_2 = (exercise.metric2Id && metrics[exercise.metric2Id]) || null;
	return {
		id: Number(exercise.id),
		name: exercise.name,
		description: exercise.description,
		metric_1,
		...(metric_2 == null ? {} : { metric_2 }),
		...(exercise.visualUrl ? { visual_url: exercise.visualUrl } : {}),
	};
}

export default function ExercisePicker({
	selected,
	onChange,
	onClose,
	matchMetricsOfFirstSelection = false,
	requiredMetrics,
	filterExercise,
}: {
	selected: Exercise[];
	onChange: (selected: Exercise[]) => void;
	onClose: () => void;
	/** Limits later selections to the metric combination of the first exercise. */
	matchMetricsOfFirstSelection?: boolean;
	/** Keeps every selection within a pre-existing group's metric combination. */
	requiredMetrics?: { metric1Id: number; metric2Id: number | null };
	filterExercise?: (exercise: Exercise) => boolean;
}) {
	const [query, setQuery] = useState('');
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [descriptions, setDescriptions] = useState<Record<number, string>>({});

	useEffect(() => {
		let active = true;
		const parameters = new ParametersService();
		Promise.all([
			parameters.search<Metric & { id: string }>('metrics'),
			parameters.search<ExerciseParameter>('exercises'),
		])
			.then(([metricList, exerciseList]) => {
				if (!active) return;
				const metrics = Object.fromEntries(
					metricList.map((metric) => [String(metric.id), metric]),
				);
				setExercises(exerciseList.map((exercise) => toExercise(exercise, metrics)));
				setDescriptions(
					Object.fromEntries(
						exerciseList.map((item) => [Number(item.id), item.description ?? '']),
					),
				);
			})
			.catch(() => active && setExercises([]));
		return () => {
			active = false;
		};
	}, []);

	const visibleExercises = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		const firstSelected = selected[0];
		return exercises.filter((exercise) => {
			const matchesQuery = !normalizedQuery || `${exercise.name} ${descriptions[exercise.id] ?? ''}`
				.toLocaleLowerCase()
				.includes(normalizedQuery);
			const metricReference = requiredMetrics ?? (matchMetricsOfFirstSelection && firstSelected
				? { metric1Id: firstSelected.metric_1.id, metric2Id: firstSelected.metric_2?.id ?? null }
				: null);
			const matchesMetrics = !metricReference || (
				exercise.metric_1.id === metricReference.metric1Id &&
				(exercise.metric_2?.id ?? null) === metricReference.metric2Id
			);
			return matchesQuery && matchesMetrics && (!filterExercise || filterExercise(exercise));
		});
	}, [exercises, descriptions, filterExercise, matchMetricsOfFirstSelection, query, requiredMetrics, selected]);

	const toggle = (exercise: Exercise) => {
		const isSelected = selected.some((item) => item.id === exercise.id);
		onChange(
			isSelected
				? selected.filter((item) => item.id !== exercise.id)
				: [...selected, exercise],
		);
	};

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
			<div className="w-full max-w-xl rounded-lg border border-outline-variant bg-surface-container p-6">
				<div className="mb-5 flex justify-between">
					<div>
						<p className="type-label-caps text-primary-fixed-dim">
							Seleção de exercícios
						</p>
						<h2 className="mt-2 text-xl font-bold">Escolha a sequência</h2>
					</div>
					<button onClick={onClose} aria-label="Fechar">
						<RiCloseLine size={24} />
					</button>
				</div>
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Nome ou descrição do exercício"
					className="mb-4 w-full border-b border-outline bg-transparent px-3 py-2 text-sm outline-none"
				/>
				<div className="max-h-[55vh] space-y-2 overflow-y-auto">
					{visibleExercises.map((exercise) => {
						const order = selected.findIndex((item) => item.id === exercise.id) + 1;
						return (
							<button
								key={exercise.id}
								onClick={() => toggle(exercise)}
								className={`relative flex w-full items-center gap-4 rounded border p-3 text-left ${order ? 'border-primary-fixed-dim bg-surface-container-high' : 'border-outline-variant'}`}
							>
								<span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded bg-surface-container-highest text-primary">
									<RiHeartPulseLine size={28} />
									{order > 0 && (
										<span className="absolute inset-0 flex items-center justify-center rounded bg-black/70 text-xl font-bold text-primary-fixed-dim">
											{order}
										</span>
									)}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-semibold">{exercise.name}</span>
									{descriptions[exercise.id] && (
										<span className="block truncate text-xs text-on-surface-variant">
											{descriptions[exercise.id]}
										</span>
									)}
								</span>
								{order > 0 && <RiCheckLine size={22} />}
							</button>
						);
					})}
				</div>
				<div className="mt-6 flex justify-end border-t border-outline-variant pt-5">
					<Button onClick={onClose}>OK</Button>
				</div>
			</div>
		</div>
	);
}
