'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { RiAddLine, RiHeartPulseLine } from 'react-icons/ri';
import type { Activity } from '@/gateway/services/workout-templates';
import { RiCloseLine } from 'react-icons/ri';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { ActivityBlock } from './ActivityBlock';
import ExercisePicker from '../shared/ExercisePicker';
import type { Template } from '@/gateway/services/workout-templates';
import type { WorkoutTemplateFormDto } from '@/gateway/services/workout-templates';
import type { Exercise } from '@/gateway/services/parametro';
import TenantSelect from '../shared/TenantSelect';
import { getSessionUser } from '@/lib/auth';
import ExerciseReorderModal from '../shared/ExerciseReorderModal';

const initialActivity: Activity = {
	exerciseId: 0,
	metric1: 0,
	metric2: 0,
	type1: 'v',
	type2: 'v',
	pse: 0,
	restDuration: 0,
	note: '',
};

export function CreateModal({
	onClose,
	onSave,
	template,
	mode = 'create',
}: {
	onClose: () => void;
	onSave: (workoutTemplate: WorkoutTemplateFormDto) => void;
	template?: Template;
	mode?: 'create' | 'view' | 'edit';
}) {
	const isViewMode = mode === 'view';
	const sessionTenantId = getSessionUser()?.tenantId ?? null;
	const [tenantId, setTenantId] = useState(
		template?.tenantId ?? sessionTenantId ?? '',
	);
	const [title, setTitle] = useState(template?.name ?? '');
	const [description, setDescription] = useState(template?.description ?? '');
	const [selected, setSelected] = useState<Exercise[]>(
		template?.exercises ?? [],
	);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [reorderOpen, setReorderOpen] = useState(false);
	const reorderPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [activities, setActivities] = useState<Record<number, Activity[]>>(() =>
		template
			? (Object.fromEntries(
					Object.entries(
						Object.groupBy(template.activities, (activity) => activity.exerciseId),
					),
				) as Record<number, Activity[]>)
			: {},
	);

	const handleSelectedChange = (next: Exercise[]) => {
		const selectedIds = new Set(next.map((exercise) => exercise.id));
		setActivities((current) => {
			const filtered = Object.fromEntries(
				Object.entries(current).filter(([id]) => selectedIds.has(Number(id))),
			);
			const updated = { ...filtered };
			next.forEach((exercise) => {
				if (!updated[exercise.id]) {
					updated[exercise.id] = [{ ...initialActivity, exerciseId: exercise.id }];
				}
			});
			return updated;
		});
		setSelected(next);
	};

	const updateActivity = (
		exerciseId: number,
		index: number,
		key: keyof Activity,
		value: string | number,
	) =>
		setActivities((current) => ({
			...current,
			[exerciseId]: (current[exerciseId] ?? []).map((item, itemIndex) =>
				itemIndex === index ? { ...item, [key]: value } : item,
			),
		}));

	const addActivity = (exerciseId: number) => {
		setActivities((current) => {
			const blocks = current[exerciseId] ?? [];
			const newBlock: Activity = {
				...(blocks.at(-1) ?? initialActivity),
				exerciseId,
			};
			delete newBlock.id;
			return {
				...current,
				[exerciseId]: [...blocks, newBlock],
			};
		});
		requestAnimationFrame(() => {
			const input = document.querySelector<HTMLInputElement>(
				`[data-exercise-id="${exerciseId}"] [data-block-index="${activities[exerciseId]?.length ?? 1}"] input`,
			);
			input?.focus();
			input?.select();
		});
	};

	const removeActivity = (exerciseId: number, index: number) => {
		setActivities((current) => ({
			...current,
			[exerciseId]: (current[exerciseId] ?? []).filter(
				(_, activityIndex) => activityIndex !== index,
			),
		}));
	};

	const cancelReorderPress = () => {
		if (reorderPressTimer.current) clearTimeout(reorderPressTimer.current);
		reorderPressTimer.current = null;
	};

	const startReorderPress = () => {
		if (isViewMode) return;
		cancelReorderPress();
		reorderPressTimer.current = setTimeout(() => {
			setReorderOpen(true);
			reorderPressTimer.current = null;
		}, 1000);
	};
	const startTouchReorderPress = (event: React.TouchEvent) => {
		event.preventDefault();
		startReorderPress();
	};
	useEffect(() => cancelReorderPress, []);

	const moveToNextField = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'Enter' || event.target instanceof HTMLTextAreaElement)
			return;
		event.preventDefault();
		const exerciseContainer = (event.target as HTMLElement).closest<HTMLElement>(
			'[data-exercise-id]',
		);
		const inputs = Array.from(
			(
				exerciseContainer ?? event.currentTarget
			).querySelectorAll<HTMLInputElement>('input'),
		);
		const currentIndex = inputs.indexOf(event.target as HTMLInputElement);
		if (exerciseContainer && currentIndex === inputs.length - 1) {
			const addBlockButton =
				exerciseContainer.querySelector<HTMLButtonElement>('[data-add-block]');
			addBlockButton?.click();
			return;
		}
		inputs[currentIndex + 1]?.focus();
		inputs[currentIndex + 1]?.select();
	};

	const saveTemplate = () => {
		const hasExerciseWithoutActivity = selected.some(
			(exercise) => !activities[exercise.id]?.length,
		);
		if (hasExerciseWithoutActivity || !tenantId) return;

		const formData = {
			tenantId,
			name: title.trim(),
			description: description.trim(),
			activities: selected.flatMap((exercise) => activities[exercise.id] ?? []),
		};
		onSave(formData);
	};
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4"
			role="dialog"
			aria-modal="true"
		>
			<div
				className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-outline-variant bg-surface-container p-6 shadow-2xl"
				onKeyDown={moveToNextField}
			>
				<div className="mb-6 flex justify-between border-b border-outline-variant pb-5">
					<div>
						<p className="type-label-caps text-primary-fixed-dim">
							{mode === 'create' ? 'Nova template' : 'Template de treino'}
						</p>
						<h2 className="mt-2 text-2xl font-bold">
							{mode === 'create'
								? 'Cadastrar template de treino'
								: isViewMode
									? 'Visualizar template de treino'
									: 'Editar template de treino'}
						</h2>
					</div>
					<button
						onClick={onClose}
						aria-label="Fechar"
						className="text-on-surface-variant hover:text-primary"
					>
						<RiCloseLine size={24} />
					</button>
				</div>
				<fieldset disabled={isViewMode} className="space-y-4 disabled:opacity-75">
					{!sessionTenantId && (
						<TenantSelect
							label="Tenant"
							value={tenantId}
							onChange={(event) => setTenantId(event.target.value)}
							placeholder="Selecione o tenant"
							required
						/>
					)}
					<Input
						label="Nome"
						value={title}
						maxLength={100}
						onChange={(ev) => setTitle(ev.target.value)}
						placeholder="Ex.: Força · Membros superiores"
					/>
					<Textarea
						label="Descrição"
						value={description}
						maxLength={255}
						onChange={(event) => setDescription(event.target.value)}
						placeholder="Descreva o objetivo do treino"
						rows={3}
					/>
				</fieldset>
				<div className="mt-7">
					<div className="flex items-center justify-between">
						<h3 className="type-headline-md">
							Exercícios{' '}
							<span className="ml-2 text-sm font-normal text-on-surface-variant">
								{selected.length}
							</span>
						</h3>
						{!isViewMode && (
							<Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
								<RiAddLine /> Adicionar exercício
							</Button>
						)}
					</div>
					<div className="mt-3 space-y-4">
						{selected.map((item, index) => (
							<div
								key={item.id}
								data-exercise-id={item.id}
								className="rounded border border-outline-variant bg-surface-container-low p-4"
							>
								<div className="flex items-center gap-3">
									<span className="w-6 font-mono text-primary-fixed-dim">
										{index + 1}.
									</span>
									<span className="text-on-surface-variant">
										<RiHeartPulseLine />
									</span>
									<h4
										className={`font-semibold ${isViewMode ? '' : 'cursor-pointer select-none touch-manipulation'}`}
										onPointerDown={startReorderPress}
										onPointerUp={cancelReorderPress}
										onPointerLeave={cancelReorderPress}
										onPointerCancel={cancelReorderPress}
										onTouchStart={startTouchReorderPress}
										onTouchEnd={cancelReorderPress}
										onTouchCancel={cancelReorderPress}
										onContextMenu={(event) => event.preventDefault()}
									>
										{item.name}
									</h4>
								</div>
								<div className="mt-3 space-y-3">
									{(activities[item.id] ?? []).map((activity, configIndex) => (
										<ActivityBlock
											key={`${item.id}-${configIndex}`}
											exercise={item}
											activity={activity}
											index={configIndex}
											disabled={isViewMode}
											onRemove={() => {
												removeActivity(item.id, configIndex);
											}}
											onChange={(key, value) =>
												updateActivity(item.id, configIndex, key, value)
											}
										/>
									))}
								</div>
								{!isViewMode && (
									<>
										<button
											type="button"
											data-add-block
											onClick={() => addActivity(item.id)}
											className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary-fixed-dim hover:text-primary"
										>
											<RiAddLine /> Adicionar outro bloco
										</button>
									</>
								)}
							</div>
						))}
						{!selected.length && (
							<p className="rounded border border-dashed border-outline-variant p-5 text-center text-sm text-on-surface-variant">
								Adicione os exercícios na ordem em que serão executados.
							</p>
						)}
					</div>
				</div>
				<div className="mt-7 flex justify-end gap-3 border-t border-outline-variant pt-5">
					<Button variant="outline" onClick={onClose}>
						{isViewMode ? 'Fechar' : 'Cancelar'}
					</Button>
					{!isViewMode && (
						<Button
							disabled={
								!title.trim() ||
								!tenantId ||
								selected.some((exercise) => !activities[exercise.id]?.length)
							}
							onClick={saveTemplate}
						>
							{mode === 'edit' ? 'Salvar alterações' : 'Criar template'}
						</Button>
					)}
				</div>
				{pickerOpen && (
					<ExercisePicker
						selected={selected}
						onChange={handleSelectedChange}
						onClose={() => setPickerOpen(false)}
					/>
				)}
				<ExerciseReorderModal
					isOpen={reorderOpen}
					exercises={selected.map(({ id, name }) => ({ id, name }))}
					onClose={() => setReorderOpen(false)}
					onApply={(exerciseIds) =>
						setSelected((current) => {
							const byId = new Map(current.map((exercise) => [exercise.id, exercise]));
							return exerciseIds.flatMap((exerciseId) => {
								const exercise = byId.get(exerciseId);
								return exercise ? [exercise] : [];
							});
						})
					}
				/>
			</div>
		</div>
	);
}
