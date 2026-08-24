'use client';

import { useEffect, useState } from 'react';
import { RiAddLine, RiCloseLine } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import ExerciseCatalogList from '@/components/shared/ExerciseCatalogList';
import ExerciseForm from './ExerciseForm';
import {
	exercisesService,
	type ExerciseParameter,
} from '@/gateway/services/parametro/exercises';
import {
	metricsService,
	type Metric,
} from '@/gateway/services/parametro/metrics';
import type { Exercise } from '@/gateway/services/parametro';

export default function ExerciseCatalogPage({
	isGlobal,
	canCreateExercise,
}: {
	isGlobal: boolean;
	canCreateExercise: boolean;
}) {
	const [catalog, setCatalog] = useState<Exercise[]>([]);
	const [descriptions, setDescriptions] = useState<Record<number, string>>({});
	const [createOpen, setCreateOpen] = useState(false);
	const [metricsById, setMetricsById] = useState<Record<number, Metric>>({});

	useEffect(() => {
		Promise.all([metricsService.search(), exercisesService.syncCatalog()]).then(
			([metrics, exercises]) => {
				const metricsById = Object.fromEntries(
					metrics.map((metric) => [metric.id, metric]),
				);
				setMetricsById(metricsById);
				const nextCatalog = exercises?.flatMap((exercise) => {
					const metric1 = metricsById[exercise.metric1Id];
					if (!metric1) return [];
					const metric2 = exercise.metric2Id
						? metricsById[exercise.metric2Id]
						: undefined;
					return [
						{
							id: Number(exercise.id),
							name: exercise.name,
							description: exercise.description,
							metric_1: metric1,
							...(metric2 ? { metric_2: metric2 } : {}),
							...(exercise.visualUrl ? { visual_url: exercise.visualUrl } : {}),
						},
					];
				});
				setCatalog(nextCatalog);
				setDescriptions(
					Object.fromEntries(
						exercises?.map((exercise) => [
							Number(exercise.id),
							exercise.description ?? '',
						]),
					),
				);
			},
		);
	}, []);

	const handleCreated = (exercise: ExerciseParameter) => {
		const metric1 = metricsById[exercise.metric1Id];
		if (!metric1) return;
		const metric2 = exercise.metric2Id
			? metricsById[exercise.metric2Id]
			: undefined;
		setCatalog((current) => [
			...current.filter((item) => item.id !== Number(exercise.id)),
			{
				id: Number(exercise.id),
				name: exercise.name,
				description: exercise.description,
				metric_1: metric1,
				...(metric2 ? { metric_2: metric2 } : {}),
			},
		]);
		setDescriptions((current) => ({
			...current,
			[Number(exercise.id)]: exercise.description ?? '',
		}));
		setCreateOpen(false);
	};

	return (
		<div className="mx-auto max-w-5xl space-y-8">
			<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div>
					<p className="type-label-caps text-primary-fixed-dim">Catálogo</p>
					<h1 className="type-headline-lg mt-2">Exercícios</h1>
					<p className="mt-2 text-on-surface-variant">
						Consulte os exercícios cadastrados ou crie um novo.
					</p>
				</div>
				{canCreateExercise && (
					<Button onClick={() => setCreateOpen(true)}>
						<RiAddLine /> Novo exercício
					</Button>
				)}
			</header>

			<ExerciseCatalogList exercises={catalog} descriptions={descriptions} />

			{createOpen && (
				<div className="fixed inset-0 z-[70] flex items-stretch justify-center overflow-y-auto bg-black/80 p-3 sm:items-center sm:p-6">
					<div className="relative flex h-full w-full flex-col overflow-y-auto border border-outline-variant bg-surface-container p-4 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:rounded-lg sm:p-6">
						<button
							type="button"
							onClick={() => setCreateOpen(false)}
							aria-label="Fechar cadastro de exercício"
							className="absolute right-4 top-4 z-10 rounded p-1 text-on-surface-variant hover:bg-surface-variant hover:text-primary"
						>
							<RiCloseLine className="text-2xl" />
						</button>
						<ExerciseForm
							isGlobal={isGlobal}
							canCreateExercise={canCreateExercise}
							onCreated={handleCreated}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
