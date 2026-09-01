'use client';

import { useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiHeartPulseLine } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import ExercisePicker from '@/components/shared/ExercisePicker';
import { ActivityBlock } from '@/components/workout-template/ActivityBlock';
import type { Activity } from '@/gateway/services/workout-templates';
import type { Exercise } from '@/gateway/services/parametro';

export type TrainingFormValues = {
	name: string;
	description: string;
	activities: Activity[];
};

const initialActivity = (exerciseId: number): Activity => ({
	exerciseId,
	metric1: 0,
	metric2: 0,
	type1: 'v',
	type2: 'v',
	pse: 0,
	restDuration: 0,
	note: '',
});

export default function TrainingForm({
	initialValues,
	initialExercises,
	onSubmit,
	onCancel,
	isSubmitting = false,
	submitLabel = 'Criar treino',
}: {
	initialValues?: Partial<TrainingFormValues>;
	initialExercises?: Exercise[];
	onSubmit: (values: TrainingFormValues) => void | Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
	submitLabel?: string;
}) {
	const [name, setName] = useState(initialValues?.name ?? '');
	const [description, setDescription] = useState(initialValues?.description ?? '');
	const [selected, setSelected] = useState<Exercise[]>(initialExercises ?? []);
	const [activities, setActivities] = useState<Record<number, Activity[]>>(() =>
		Object.groupBy(initialValues?.activities ?? [], (activity) => activity.exerciseId) as Record<number, Activity[]>,
	);
	const [pickerOpen, setPickerOpen] = useState(false);
	const canSubmit =
		!!name.trim() &&
		selected.length > 0 &&
		selected.every((exercise) => (activities[exercise.id] ?? []).length > 0);

	const changeSelected = (next: Exercise[]) => {
		const ids = new Set(next.map((exercise) => exercise.id));
		setActivities((current) => {
			const nextActivities = Object.fromEntries(
				Object.entries(current).filter(([id]) => ids.has(Number(id))),
			) as Record<number, Activity[]>;
			next.forEach((exercise) => {
				if (!nextActivities[exercise.id])
					nextActivities[exercise.id] = [initialActivity(exercise.id)];
			});
			return nextActivities;
		});
		setSelected(next);
	};

	const removeExercise = (exerciseId: number) => {
		setSelected((current) => current.filter((exercise) => exercise.id !== exerciseId));
		setActivities((current) =>
			Object.fromEntries(
				Object.entries(current).filter(([id]) => Number(id) !== exerciseId),
			) as Record<number, Activity[]>,
		);
	};

	const updateActivity = (
		exerciseId: number,
		index: number,
		key: keyof Activity,
		value: string | number,
	) =>
		setActivities((current) => ({
			...current,
			[exerciseId]: (current[exerciseId] ?? []).map((activity, activityIndex) =>
				activityIndex === index ? { ...activity, [key]: value } : activity,
			),
		}));

	const submit = async () => {
		if (!canSubmit) return;
		await onSubmit({
			name: name.trim(),
			description: description.trim(),
			activities: selected.flatMap((exercise) => activities[exercise.id] ?? []),
		});
	};

	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<Input
					label="Nome do treino"
					value={name}
					maxLength={100}
					onChange={(event) => setName(event.target.value)}
					placeholder="Ex.: Treino de peito e tríceps"
					required
				/>
				<Textarea
					label="Descrição"
					value={description}
					maxLength={255}
					onChange={(event) => setDescription(event.target.value)}
					placeholder="Descreva o objetivo do treino"
					rows={3}
				/>
			</div>

			<section aria-labelledby="training-form-exercises">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<h3 id="training-form-exercises" className="type-headline-md">
						Exercícios <span className="ml-2 text-sm font-normal text-on-surface-variant">{selected.length}</span>
					</h3>
					<Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
						<RiAddLine /> Adicionar exercício
					</Button>
				</div>
				<div className="mt-3 space-y-4">
					{selected.map((exercise, exerciseIndex) => (
						<div key={exercise.id} className="rounded border border-outline-variant bg-surface-container-low p-3 sm:p-4">
							<div className="flex items-center justify-between gap-3">
								<div className="flex min-w-0 items-center gap-3">
									<span className="w-6 font-mono text-primary-fixed-dim">{exerciseIndex + 1}.</span>
									<RiHeartPulseLine className="shrink-0 text-on-surface-variant" />
									<h4 className="truncate font-semibold">{exercise.name}</h4>
								</div>
								<button
									type="button"
									onClick={() => removeExercise(exercise.id)}
									aria-label={`Remover exercício ${exercise.name}`}
									className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-error hover:bg-error-container/20"
								>
									<RiDeleteBinLine />
								</button>
							</div>
								<div className="mt-3 space-y-3">
								{(activities[exercise.id] ?? []).map((activity, index) => (
									<ActivityBlock
										key={`${exercise.id}-${index}`}
										exercise={exercise}
										activity={activity}
										index={index}
										onChange={(key, value) => updateActivity(exercise.id, index, key, value)}
										onRemove={() =>
											setActivities((current) => ({
												...current,
												[exercise.id]: current[exercise.id].filter((_, itemIndex) => itemIndex !== index),
											}))
										}
									/>
								))}
							</div>
							<button
								type="button"
								onClick={() => setActivities((current) => ({ ...current, [exercise.id]: [...(current[exercise.id] ?? []), { ...(current[exercise.id]?.at(-1) ?? initialActivity(exercise.id)), exerciseId: exercise.id }] }))}
								className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary-fixed-dim hover:text-primary"
							>
								<RiAddLine /> Adicionar outra série
							</button>
						</div>
					))}
					{!selected.length && <p className="rounded border border-dashed border-outline-variant p-5 text-center text-sm text-on-surface-variant">Adicione os exercícios na ordem em que serão executados.</p>}
				</div>
			</section>

			<div className="flex flex-col-reverse gap-3 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
				<Button variant="outline" onClick={onCancel}>Cancelar</Button>
				<Button disabled={!canSubmit || isSubmitting} onClick={() => void submit()}>
					{isSubmitting ? 'Criando...' : submitLabel}
				</Button>
			</div>
			{pickerOpen && <ExercisePicker selected={selected} onChange={changeSelected} onClose={() => setPickerOpen(false)} />}
		</div>
	);
}
