'use client';

import { useState, type KeyboardEvent } from 'react';
import { RiAddLine, RiHeartPulseLine } from 'react-icons/ri';
import type { Activity } from '@/app/(authenticated)/workout-template/types';
import { RiCloseLine } from 'react-icons/ri';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import Button from '../ui/Button';
import { ConfigBlock } from './ConfigBlock';
import ExercisePicker from '../shared/ExercisePicker';
import type { Template } from '../../app/(authenticated)/workout-template/types';
import type {
	CreateWorkoutTemplateDto,
	Exercise,
} from '@/app/(authenticated)/workout-template/types';

export function CreateModal({
	onClose,
	onSave,
	template,
	mode = 'create',
}: {
	onClose: () => void;
	onSave: (workoutTemplate: CreateWorkoutTemplateDto) => void;
	template?: Template;
	mode?: 'create' | 'view' | 'edit';
}) {
	const isViewMode = mode === 'view';
	const [title, setTitle] = useState(template?.title ?? '');
	const [description, setDescription] = useState(template?.description ?? '');
	const [selected, setSelected] = useState<Exercise[]>(
		template?.exercises ?? [],
	);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [activities, setActivities] = useState<Record<number, Activity[]>>({});

	const handleSelectedChange = (next: Exercise[]) => {
		const selectedIds = new Set(next.map((exercise) => exercise.id));
		setActivities((current) =>
			Object.fromEntries(
				Object.entries(current).filter(([id]) => selectedIds.has(Number(id))),
			),
		);
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
			return {
				...current,
				[exerciseId]: [...blocks, { ...blocks[blocks.length - 1] }],
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
		const toNumber = (value: string) => {
			const numberValue = Number(value);
			return Number.isFinite(numberValue) ? numberValue : 0;
		};

		onSave({
			name: title.trim(),
			description: description.trim(),
			activities: Object.values(activities).flat(),
		});
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
									<span className="font-semibold">{item.name}</span>
								</div>
								<div className="mt-3 space-y-3">
									{(activities[item.id] ?? []).map((activity, configIndex) => (
										<ConfigBlock
											key={`${item.id}-${configIndex}`}
											exercise={item}
											activity={activity}
											index={configIndex}
											disabled={isViewMode}
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
						<Button disabled={!title.trim()} onClick={saveTemplate}>
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
			</div>
		</div>
	);
}
