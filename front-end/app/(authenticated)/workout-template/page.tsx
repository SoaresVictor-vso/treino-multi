'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
	RiAddLine,
	RiHeartPulseLine,
	RiCheckLine,
	RiCloseLine,
} from 'react-icons/ri';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import TemplatePreview from '@/components/workout-template/TemplatePreview';
import TemplateStats from '@/components/workout-template/TemplateStats';
import TemplatesTable from '@/components/workout-template/TemplatesTable';
import { CreateModal } from '@/components/workout-template/CreateModal';
import type {
	Template,
	TemplateModalState,
	ExerciseConfig,
} from '@/components/workout-template/types';
import {
	DEFAULT_REST_DURATION,
	getConfigsFromActivities,
	secondsToTime,
	timeToSeconds,
	type RegisterType,
} from '@/components/workout-template/types';
import { exercises as seedExercises, metricLabels, metricUnits } from './mocks';
import ExercisePicker from '@/components/shared/ExercisePicker';
import { exercisesService } from '@/api/services/parametro/exercises';
import type { CreateWorkoutTemplateDto, Exercise, Metric } from './types';

const initialTemplates: Template[] = [
	{
		id: 1,
		title: 'Força · Membros inferiores',
		description:
			'Base de força para membros inferiores com foco em controle e progressão.',
		exercises: [seedExercises[0], seedExercises[2]],
		activities: [
			{
				exercise: 1,
				metric_1: 10,
				metric_2: 60,
				type_1: 'v',
				type_2: 'v',
				pse: 7,
			},
			{
				exercise: 1,
				metric_1: 8,
				metric_2: 70,
				type_1: 'v',
				type_2: 'v',
				pse: 8,
			},
			{
				exercise: 3,
				metric_1: 8,
				metric_2: 80,
				type_1: 'v',
				type_2: 'v',
				pse: 8,
			},
		],
	},
	{
		id: 2,
		title: 'Condicionamento · HIIT',
		description: 'Circuito intervalado para elevar a capacidade cardiovascular.',
		exercises: [seedExercises[3]],
		activities: [
			{
				exercise: 4,
				metric_1: 2,
				metric_2: 5,
				type_1: 'v',
				type_2: 'v',
				pse: 8,
			},
			{
				exercise: 4,
				metric_1: 1,
				metric_2: 4.5,
				type_1: 'v',
				type_2: 'v',
				pse: 9,
			},
		],
	},
];

export default function WorkoutTemplatePage() {
	const [templates, setTemplates] = useState(initialTemplates);
	const [selected, setSelected] = useState(initialTemplates[0]);
	const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(
		null,
	);
	const [actionsTemplate, setActionsTemplate] = useState<Template | null>(null);
	const [templateToRemove, setTemplateToRemove] = useState<Template | null>(
		null,
	);
	const [query, setQuery] = useState('');
	const [createOpen, setCreateOpen] = useState(false);

	const filtered = useMemo(
		() =>
			templates.filter((item) =>
				item.title.toLowerCase().includes(query.toLowerCase()),
			),
		[templates, query],
	);
	const saveTemplate = (
		workoutTemplate: CreateWorkoutTemplateDto,
		exercises: Exercise[],
	) => {
		console.log('DTO de criação da WorkoutTemplate:', workoutTemplate);

		const saved: Template = {
			id: Date.now(),
			title: workoutTemplate.name,
			description: workoutTemplate.description,
			exercises,
			activities: workoutTemplate.activities,
		};
		setTemplates((current) => [...current, saved]);
		setSelected(saved);
		setCreateOpen(false);
	};
	const updateTemplate = (
		id: number,
		workoutTemplate: CreateWorkoutTemplateDto,
		exercises: Exercise[],
	) => {
		setTemplates((current) =>
			current.map((template) =>
				template.id === id
					? {
							...template,
							title: workoutTemplate.name,
							description: workoutTemplate.description,
							exercises,
							activities: workoutTemplate.activities,
						}
					: template,
			),
		);
		setSelected((current) =>
			current.id === id
				? {
						...current,
						title: workoutTemplate.name,
						description: workoutTemplate.description,
						exercises,
						activities: workoutTemplate.activities,
					}
				: current,
		);
		setTemplateModal(null);
	};
	const removeTemplate = (template: Template) => {
		setTemplates((current) => current.filter((item) => item.id !== template.id));
		setSelected((current) =>
			current.id === template.id
				? (templates.find((item) => item.id !== template.id) ?? current)
				: current,
		);
		setTemplateToRemove(null);
	};

	return (
		<div className="mx-auto max-w-[1440px] space-y-8 p-4 md:p-8">
			<header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
				<div>
					<p className="type-label-caps text-primary-fixed-dim">
						Biblioteca de treinos
					</p>
					<h1 className="type-headline-lg mt-2">Templates de treino</h1>
					<p className="mt-2 max-w-xl text-on-surface-variant">
						Crie e reutilize estruturas de treino para acelerar a prescrição dos seus
						alunos.
					</p>
				</div>
				<Button onClick={() => setCreateOpen(true)}>
					<RiAddLine size={20} /> Nova template
				</Button>
			</header>
			<TemplateStats
				templateCount={templates.length}
				exerciseCount={templates.reduce(
					(total, item) => total + item.exercises.length,
					0,
				)}
			/>
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
				<TemplatesTable
					templates={filtered}
					selectedId={selected.id}
					query={query}
					actionsTemplateId={actionsTemplate?.id ?? null}
					onQueryChange={setQuery}
					onSelect={setSelected}
					onToggleActions={(template) =>
						setActionsTemplate((current) =>
							current?.id === template.id ? null : template,
						)
					}
					onEdit={(template) => {
						setTemplateModal({ mode: 'edit', template });
						setActionsTemplate(null);
					}}
					onView={(template) => {
						setTemplateModal({ mode: 'view', template });
						setActionsTemplate(null);
					}}
					onRemove={(template) => {
						setTemplateToRemove(template);
						setActionsTemplate(null);
					}}
				/>
				<TemplatePreview template={selected} />
			</div>
			{createOpen && (
				<CreateModal onClose={() => setCreateOpen(false)} onSave={saveTemplate} />
			)}
			{templateModal && (
				<CreateModal
					key={`${templateModal.mode}-${templateModal.template.id}`}
					template={templateModal.template}
					mode={templateModal.mode}
					onClose={() => setTemplateModal(null)}
					onSave={(workoutTemplate, exercises) =>
						updateTemplate(templateModal.template.id, workoutTemplate, exercises)
					}
				/>
			)}
			{templateToRemove && (
				<Modal
					isOpen
					title="Remover template"
					description={`Deseja remover a template ${templateToRemove.title}? Esta ação não poderá ser desfeita.`}
					onClose={() => setTemplateToRemove(null)}
				>
					<div className="flex justify-end gap-3">
						<Button variant="outline" onClick={() => setTemplateToRemove(null)}>
							Cancelar
						</Button>
						<Button onClick={() => removeTemplate(templateToRemove)}>Remover</Button>
					</div>
				</Modal>
			)}
		</div>
	);
}
