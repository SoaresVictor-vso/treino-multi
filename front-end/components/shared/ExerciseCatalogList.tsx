'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { RiCheckLine, RiHeartPulseLine } from 'react-icons/ri';
import type { Exercise } from '@/gateway/services/parametro';
import {
	exercisesService,
	type ExerciseSearchResult,
} from '@/gateway/services/parametro/exercises';

const searchCatalogExercises = (query: string) => exercisesService.search(query);

export default function ExerciseCatalogList({
	exercises,
	descriptions,
	selected = [],
	onToggle,
	listRef,
	filterExercise,
	requiredMetrics,
	matchMetricsOfFirstSelection = false,
	searchExercises = searchCatalogExercises,
}: {
	exercises: Exercise[];
	descriptions?: Record<number, string>;
	selected?: Exercise[];
	onToggle?: (exercise: Exercise) => void;
	listRef?: RefObject<HTMLDivElement | null>;
	filterExercise?: (exercise: Exercise) => boolean;
	requiredMetrics?: { metric1Id: number; metric2Id: number | null };
	matchMetricsOfFirstSelection?: boolean;
	searchExercises?: (query: string) => Promise<ExerciseSearchResult[]>;
}) {
	const [query, setQuery] = useState('');
	const [indexedSearch, setIndexedSearch] = useState<{
		query: string;
		results: ExerciseSearchResult[];
	} | null>(null);
	const firstSelected = selected[0];
	const normalizedQuery = query.trim();

	useEffect(() => {
		if (!normalizedQuery) {
			return;
		}

		let active = true;
		const timeout = window.setTimeout(() => {
			searchExercises(normalizedQuery)
				.then((results) => {
					if (!active) return;
					setIndexedSearch({
						query: normalizedQuery,
						results,
					});
				})
				.catch(() => {
					if (active) setIndexedSearch({ query: normalizedQuery, results: [] });
				});
		}, 200);

		return () => {
			active = false;
			window.clearTimeout(timeout);
		};
	}, [normalizedQuery, searchExercises]);

	const visibleExercises = useMemo(() => {
		const metricReference =
			requiredMetrics ??
			(matchMetricsOfFirstSelection && firstSelected
				? {
						metric1Id: firstSelected.metric_1.id,
						metric2Id: firstSelected.metric_2?.id ?? null,
					}
				: null);
		const searchIsCurrent = indexedSearch?.query === normalizedQuery;
		const exercisesWithScore = searchIsCurrent
			? indexedSearch.results.flatMap((result) => {
					const exercise = exercises.find(
						(item) => item.id === Number(result.id),
					);
					return exercise
						? [{ ...exercise, scorePonderado: result.scorePonderado }]
						: [];
				})
			: exercises.map((exercise) => ({ ...exercise, scorePonderado: 0 }));
		const filteredExercises = exercisesWithScore.filter((exercise) => {
			const matchesQuery = !normalizedQuery || searchIsCurrent;
			const matchesMetrics =
				!metricReference ||
				(exercise.metric_1.id === metricReference.metric1Id &&
					(exercise.metric_2?.id ?? null) === metricReference.metric2Id);
			return (
				matchesQuery &&
				matchesMetrics &&
				(!filterExercise || filterExercise(exercise))
			);
		});
		if (!searchIsCurrent) return filteredExercises;

		return [...filteredExercises].sort(
			(left, right) => right.scorePonderado - left.scorePonderado,
		);
	}, [
		exercises,
		filterExercise,
		firstSelected,
		indexedSearch,
		matchMetricsOfFirstSelection,
		normalizedQuery,
		requiredMetrics,
		selected,
	]);

	return (
		<>
			<input
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				placeholder="Nome ou descrição do exercício"
				className="mb-4 w-full shrink-0 border-b border-outline bg-transparent px-3 py-2 text-sm outline-none"
			/>
			<div
				ref={listRef}
				className="min-h-0 flex-1 space-y-2 overflow-y-auto sm:max-h-[55vh] sm:flex-none"
			>
				{visibleExercises.map((exercise) => {
					const order =
						selected.findIndex(
							(item) => Number(item.id) === Number(exercise.id),
						) + 1;
					const content = (
						<>
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
								{(descriptions?.[exercise.id] ?? exercise.description) && (
									<span className="block truncate text-xs text-on-surface-variant">
										{descriptions?.[exercise.id] ?? exercise.description}
									</span>
								)}
							</span>
							{order > 0 && <RiCheckLine className="shrink-0 text-xl" />}
						</>
					);
					return onToggle ? (
						<button
							key={exercise.id}
							data-exercise-id={exercise.id}
							onClick={() => onToggle(exercise)}
							className={`relative flex w-full items-center gap-3 rounded border p-3 text-left sm:gap-4 ${order ? 'border-primary-fixed-dim bg-surface-container-high' : 'border-outline-variant'}`}
						>
							{content}
						</button>
					) : (
						<div
							key={exercise.id}
							data-exercise-id={exercise.id}
							className="relative flex w-full items-center gap-3 rounded border border-outline-variant p-3 text-left sm:gap-4"
						>
							{content}
						</div>
					);
				})}
			</div>
		</>
	);
}
