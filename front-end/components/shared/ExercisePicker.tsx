'use client';

import { useEffect, useRef, useState } from 'react';
import { RiAddLine, RiCloseLine } from 'react-icons/ri';
import {
	ParametersService,
	type ExerciseParameter,
} from '@/gateway/services/parametro';
import type { ExerciseParameter as ExerciseParameterResponse } from '@/gateway/services/parametro/exercises';
import Button from '@/components/ui/Button';
import ExerciseForm from '@/components/exercises/ExerciseForm';
import ExerciseCatalogList from './ExerciseCatalogList';
import { usePermissions } from './PermissionProvider';
import {
	MetricFieldType,
	type Exercise,
	type Metric,
} from '@/gateway/services/parametro';

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
	const { canCreateExercise, isGlobal } = usePermissions();
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [metricsById, setMetricsById] = useState<Record<string, Metric>>({});
	const [descriptions, setDescriptions] = useState<Record<number, string>>({});
	const [createExerciseOpen, setCreateExerciseOpen] = useState(false);
	const [newlyCreatedExerciseId, setNewlyCreatedExerciseId] = useState<number | null>(null);
	const exerciseListRef = useRef<HTMLDivElement>(null);

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
				setMetricsById(metrics);
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

	useEffect(() => {
		if (newlyCreatedExerciseId === null) return;
		const frame = requestAnimationFrame(() => {
			exerciseListRef.current
				?.querySelector<HTMLElement>(
					`[data-exercise-id="${newlyCreatedExerciseId}"]`,
				)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			setNewlyCreatedExerciseId(null);
		});
		return () => cancelAnimationFrame(frame);
	}, [newlyCreatedExerciseId, exercises]);

	const toggle = (exercise: Exercise) => {
		const isSelected = selected.some((item) => item.id === exercise.id);
		onChange(
			isSelected
				? selected.filter((item) => item.id !== exercise.id)
				: [...selected, exercise],
		);
	};

	const handleCreatedExercise = async (created: ExerciseParameterResponse) => {
		let availableMetrics = metricsById;
		if (!availableMetrics[created.metric1Id]) {
			const metricList = await new ParametersService().search<Metric & { id: string }>('metrics');
			availableMetrics = Object.fromEntries(
				metricList.map((metric) => [String(metric.id), metric]),
			);
			setMetricsById(availableMetrics);
		}
		const exercise = toExercise(created, availableMetrics);
		setExercises((current) => [
			...current.filter((item) => item.id !== exercise.id),
			exercise,
		]);
		setDescriptions((current) => ({
			...current,
			[exercise.id]: exercise.description ?? '',
		}));
		if (!selected.some((item) => item.id === exercise.id)) {
			setNewlyCreatedExerciseId(exercise.id);
			onChange([...selected, exercise]);
		}
		setCreateExerciseOpen(false);
	};

	return (
		<div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-black/80 sm:items-center sm:p-4">
			<div className="flex h-full w-full flex-col border border-outline-variant bg-surface-container p-4 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:rounded-lg sm:p-6">
				<div className="mb-4 flex shrink-0 justify-between gap-4 sm:mb-5">
					<div>
						<p className="type-label-caps text-primary-fixed-dim">
							Seleção de exercícios
						</p>
						<h2 className="mt-2 text-lg font-bold sm:text-xl">Escolha a sequência</h2>
					</div>
					<button onClick={onClose} aria-label="Fechar" className="shrink-0 p-1">
						<RiCloseLine className="text-2xl" />
					</button>
				</div>
				<ExerciseCatalogList
					exercises={exercises}
					descriptions={descriptions}
					selected={selected}
					onToggle={toggle}
					listRef={exerciseListRef}
					filterExercise={filterExercise}
					requiredMetrics={requiredMetrics}
					matchMetricsOfFirstSelection={matchMetricsOfFirstSelection}
				/>
				{/*
				<div
					ref={exerciseListRef}
					className="min-h-0 flex-1 space-y-2 overflow-y-auto sm:max-h-[55vh] sm:flex-none"
				>
					{visibleExercises.map((exercise) => {
						const order = selected.findIndex((item) => item.id === exercise.id) + 1;
						return (
							<button
								key={exercise.id}
								data-exercise-id={exercise.id}
								onClick={() => toggle(exercise)}
								className={`relative flex w-full items-center gap-3 rounded border p-3 text-left sm:gap-4 ${order ? 'border-primary-fixed-dim bg-surface-container-high' : 'border-outline-variant'}`}
							>
								<span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded bg-surface-container-highest text-primary sm:h-14 sm:w-14">
									<RiHeartPulseLine className="text-2xl sm:text-3xl" />
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
								{order > 0 && <RiCheckLine className="shrink-0 text-xl" />}
							</button>
						);
					})}
				</div>*/}
				<div className="mt-4 flex shrink-0 flex-col-reverse gap-3 border-t border-outline-variant pt-4 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
					{canCreateExercise ? (
						<button
							type="button"
							onClick={() => setCreateExerciseOpen(true)}
							className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-outline-variant px-3 py-2 text-sm font-bold text-on-surface-variant hover:border-primary-fixed-dim/40 hover:text-primary"
						>
							<RiAddLine /> Criar exercício
						</button>
					) : null}
					<Button onClick={onClose}>OK</Button>
				</div>
			</div>
			{createExerciseOpen && (
				<div className="fixed inset-0 z-[70] flex items-stretch justify-center overflow-y-auto bg-black/80 p-3 sm:items-center sm:p-6">
					<div className="relative flex h-full w-full flex-col overflow-y-auto border border-outline-variant bg-surface-container p-4 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:rounded-lg sm:p-6">
						<button
							type="button"
							onClick={() => setCreateExerciseOpen(false)}
							aria-label="Fechar cadastro de exercício"
							className="absolute right-4 top-4 z-10 rounded p-1 text-on-surface-variant hover:bg-surface-variant hover:text-primary"
						>
							<RiCloseLine className="text-2xl" />
						</button>
						<ExerciseForm
							isGlobal={isGlobal}
							canCreateExercise={canCreateExercise}
							onCreated={handleCreatedExercise}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
