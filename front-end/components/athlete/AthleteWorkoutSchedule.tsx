'use client';

import { useMemo, useState } from 'react';
import {
	WorkoutCalendar,
	type DatedWorkout,
} from '@/components/athlete-app/AthleteHome';
import { localDateKey } from '@/components/ui/Calendar';
import type {
	AthleteWorkout,
	CalendarWorkout,
} from '@/gateway/services/workouts';

function calendarDate(workout: AthleteWorkout) {
	if (workout.status === 'in_progress') return localDateKey(new Date());
	if (['completed', 'cancelled', 'skipped'].includes(workout.status))
		return workout.performedAt
			? localDateKey(workout.performedAt)
			: workout.scheduledDate;
	return workout.scheduledDate;
}

export default function AthleteWorkoutSchedule({
	workouts,
	onChanged,
}: {
	workouts: AthleteWorkout[];
	onChanged: () => void;
}) {
	const [month, setMonth] = useState(
		() => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
	);
	const entries = useMemo<DatedWorkout[]>(
		() =>
			workouts.flatMap((workout) => {
				const date = calendarDate(workout);
				return date ? [{ ...workout, date }] : [];
			}),
		[workouts],
	);
	const undated = useMemo<CalendarWorkout[]>(
		() =>
			workouts
				.filter(
					(workout) =>
						!workout.scheduledDate &&
						['pending', 'scheduled'].includes(workout.status),
				)
				.map((workout) => ({ ...workout, performedAt: null })),
		[workouts],
	);

	return (
		<section aria-label="Acompanhamento dos treinos do atleta">
			<WorkoutCalendar
				month={month}
				workouts={entries}
				undated={undated}
				onMonthChange={setMonth}
				onChanged={onChanged}
			/>
		</section>
	);
}
