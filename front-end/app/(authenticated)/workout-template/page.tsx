'use client';

import { useEffect, useMemo, useState } from 'react';
import { RiAddLine } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TemplatePreview from '@/components/workout-template/TemplatePreview';
import TemplateStats from '@/components/workout-template/TemplateStats';
import TemplatesTable from '@/components/workout-template/TemplatesTable';
import { CreateModal } from '@/components/workout-template/CreateModal';
import type {
	CreateWorkoutTemplateDto,
	Template,
	TemplateModalState,
} from '@/api/services/workout-templates';
import * as workoutTemplatesService from '@/api/services/workout-templates';

const toTemplate = (
	item: workoutTemplatesService.WorkoutTemplateResponse,
): Template => {
	const exercises = item.activities.reduce<Template['exercises']>(
		(result, activity) => {
			if (
				activity.exercise &&
				!result.some((exercise) => exercise.id === activity.exercise?.id)
			) {
				result.push(activity.exercise);
			}
			return result;
		},
		[],
	);
	return {
		id: Number(item.id),
		title: item.name,
		description: item.description,
		exercises,
		activities: item.activities.map(
			({
				exerciseId,
				metric1,
				metric2,
				type1,
				type2,
				pse,
				restDuration,
				note,
			}) => ({
				exercise: exerciseId,
				metric_1: metric1 ?? undefined,
				metric_2: metric2 ?? undefined,
				type_1: type1 === 'v' ? 'v' : 'v',
				type_2: type2,
				pse,
				rest_duration: restDuration ?? undefined,
				note: note ?? undefined,
			}),
		),
	};
};

export default function WorkoutTemplatePage() {
	const [templates, setTemplates] = useState<Template[]>([]);
	const [selected, setSelected] = useState<Template | null>(null);
	const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(
		null,
	);
	const [actionsTemplate, setActionsTemplate] = useState<Template | null>(null);
	const [templateToRemove, setTemplateToRemove] = useState<Template | null>(
		null,
	);
	const [query, setQuery] = useState('');
	const [createOpen, setCreateOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		workoutTemplatesService
			.findAll()
			.then(async (summaries) => {
				const loaded = await Promise.all(
					(summaries.data ?? []).map((summary) =>
						workoutTemplatesService.findOne(summary.id),
					),
				);
				const next = loaded.flatMap((response) =>
					response.data ? [toTemplate(response.data)] : [],
				);
				setTemplates(next);
				setSelected(next[0] ?? null);
			})
			.catch(() =>
				setError(
					'Não foi possível carregar as templates. Por favor, tente novamente.',
				),
			);
	}, []);

	const filtered = useMemo(
		() =>
			templates.filter((item) =>
				item.title.toLowerCase().includes(query.toLowerCase()),
			),
		[templates, query],
	);

	const saveTemplate = async (workoutTemplate: CreateWorkoutTemplateDto) => {
		try {
			const created = await workoutTemplatesService.create(workoutTemplate);
			if (!created.data) throw new Error(created.error);
			const next = toTemplate(created.data);
			setTemplates((current) => [...current, next]);
			setSelected(next);
			setCreateOpen(false);
		} catch (error) {
			console.error(error);
			setError(`Não foi possível salvar a template. Por favor, tente novamente.`);
		}
	};

	const updateTemplate = async (id: number, data: CreateWorkoutTemplateDto) => {
		try {
			const response = await workoutTemplatesService.update(String(id), data);
			if (!response.data) throw new Error(response.error);
			const updated = toTemplate(response.data);
			setTemplates((current) =>
				current.map((item) => (item.id === id ? updated : item)),
			);
			setSelected((current) => (current?.id === id ? updated : current));
			setTemplateModal(null);
		} catch (error) {
			console.error(error);
			setError(`Não foi possível salvar a template. Por favor, tente novamente.`);
		}
	};

	const removeTemplate = async (template: Template) => {
		try {
			await workoutTemplatesService.remove(String(template.id));
			setTemplates((current) => {
				const next = current.filter((item) => item.id !== template.id);
				setSelected((selected) =>
					selected?.id === template.id ? (next[0] ?? null) : selected,
				);
				return next;
			});
			setTemplateToRemove(null);
		} catch (error) {
			console.error(error);
			setError('Não foi possível remover a template. Por favor, tente novamente.');
		}
	};

	return (
		<div className="mx-auto max-w-[1440px] space-y-8 p-4 md:p-8">
			{error && (
				<p className="rounded border border-error bg-error-container/20 p-3 text-error">
					{error}
				</p>
			)}
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
					selectedId={selected?.id ?? null}
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
				{selected && <TemplatePreview template={selected} />}
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
					onSave={(workoutTemplate) =>
						updateTemplate(templateModal.template.id, workoutTemplate)
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
