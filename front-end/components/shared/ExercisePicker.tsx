'use client';

import { useEffect, useMemo, useState } from 'react';
import { RiCheckLine, RiCloseLine, RiHeartPulseLine } from 'react-icons/ri';
import {
	ParametersService,
	type ExerciseParameter,
	type Metrics,
} from '@/api/services/parametro';
import Button from '@/components/ui/Button';
import type {
	Exercise,
	Metric,
} from '@/app/(authenticated)/workout-template/types';

const metricByName: Record<string, Metric> = {
	repeticoes: 'repetition',
	repetição: 'repetition',
	repetition: 'repetition',
	peso: 'weight',
	weight: 'weight',
	tempo: 'time',
	time: 'time',
	distancia: 'distance',
	distância: 'distance',
	distance: 'distance',
	ritmo: 'pace',
	pace: 'pace',
};

function toExercise(
	parameter: ExerciseParameter,
	metrics: Record<string, Metrics>,
): Exercise {
	const metric = (id: number | null | undefined): Metric =>
		metricByName[metrics[String(id)]?.name.trim().toLocaleLowerCase()] ??
		'repetition';
	return {
		id: Number(parameter.id),
		name: parameter.name,
		metric_1: metric(parameter.metric1Id),
		...(parameter.metric2Id == null
			? {}
			: { metric_2: metric(parameter.metric2Id) }),
		...(parameter.visualUrl ? { visual_url: parameter.visualUrl } : {}),
	};
}

export default function ExercisePicker({
	selected,
	onChange,
	onClose,
}: {
	selected: Exercise[];
	onChange: (selected: Exercise[]) => void;
	onClose: () => void;
}) {
	const [query, setQuery] = useState('');
	const [catalog, setCatalog] = useState<Exercise[]>([]);
	const [descriptions, setDescriptions] = useState<Record<number, string>>({});

	useEffect(() => {
		let active = true;
		const parameters = new ParametersService();
		Promise.all([
			parameters.search<Metrics>('metrics'),
			parameters.search<ExerciseParameter>('exercises'),
		])
			.then(([metricList, exerciseList]) => {
				if (!active) return;
				const metrics = Object.fromEntries(
					metricList.map((metric) => [String(metric.id), metric]),
				);
				setCatalog(exerciseList.map((exercise) => toExercise(exercise, metrics)));
				setDescriptions(
					Object.fromEntries(
						exerciseList.map((item) => [Number(item.id), item.description ?? '']),
					),
				);
			})
			.catch(() => active && setCatalog([]));
		return () => {
			active = false;
		};
	}, []);

	const visibleExercises = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		if (!normalizedQuery) return catalog;
		return catalog.filter((exercise) =>
			`${exercise.name} ${descriptions[exercise.id] ?? ''}`
				.toLocaleLowerCase()
				.includes(normalizedQuery),
		);
	}, [catalog, descriptions, query]);

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
