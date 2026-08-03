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
	Template,
	TemplateModalState,
	WorkoutTemplateFormDto,
	UpdateWorkoutTemplateDto,
} from '@/api/services/workout-templates';
import * as workoutTemplatesService from '@/api/services/workout-templates';

const toTemplate = (
	item: workoutTemplatesService.WorkoutTemplateResponse,
): Template => ({
	id: item.id,
	tenantId: item.tenantId,
	name: item.name,
	description: item.description,
	exercises: Array.from(
		new Map(
			item.activities
				.filter((activity) => activity.exercise)
				.map((activity) => [activity.exercise!.id, activity.exercise!]),
		).values(),
	).map((exercise) => ({
		id: exercise.id,
		name: exercise.name,
		description: exercise.description,
		// The workout-template API serializes TypeORM relations in camelCase,
		// while the form's Exercise type uses snake_case.
		metric_1: exercise.metric1,
		metric_2: exercise.metric2 ?? undefined,
	})),
	activities: item.activities.map((activity) => ({
		id: activity.id,
		exerciseId: activity.exerciseId,
		metric1: Number(activity.metric1 ?? 0),
		metric2: Number(activity.metric2 ?? 0),
		type1: 'v',
		type2: activity.type2,
		pse: Number(activity.pse ?? 0),
		restDuration: activity.restDuration ?? undefined,
		note: activity.note ?? undefined,
	})),
});

export default function WorkoutTemplatePage() {
	const [templates, setTemplates] = useState<
		workoutTemplatesService.WorkoutTemplateSummary[]
	>([]);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
		null,
	);
	const [actionsTemplateId, setActionsTemplateId] = useState<string | null>(
		null,
	);
	const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(
		null,
	);
	const [query, setQuery] = useState('');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		console.log('actionsTemplateId', actionsTemplateId);
	}, [actionsTemplateId]);

	useEffect(() => {
		if (!templateModal?.templateId || templateModal.mode === 'remove') return;
		workoutTemplatesService
			.findOne(String(templateModal.templateId))
			.then((response) => {
				if (response.data)
					setTemplateModal((current) =>
						current ? { ...current, template: toTemplate(response.data!) } : null,
					);
			});
	}, [templateModal?.templateId, templateModal?.mode]);

	useEffect(() => {
		workoutTemplatesService
			.findAll()
			.then(async (summaries) => {
				const next = summaries.data ?? [];
				setTemplates(next);
				setSelectedTemplateId(next[0]?.id ?? null);
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
				item.name.toLowerCase().includes(query.toLowerCase()),
			),
		[templates, query],
	);

	const saveTemplate = async (workoutTemplate: WorkoutTemplateFormDto) => {
		try {
			const created = await workoutTemplatesService.create({
			...workoutTemplate,
			activities: workoutTemplate.activities.map(({ id: _id, ...activity }) =>
				activity,
			),
		});
			if (!created.data) {
				setError(
					created.error ||
						'Não foi possível salvar a template. Por favor, tente novamente.',
				);
				return;
			}
			const next = {
				id: created.data.id,
				name: created.data.name,
				description: created.data.description,
				exercises: Array.from(
					new Set(
						created.data.activities.flatMap((a) =>
							a.exercise?.name ? [a.exercise.name] : [],
						),
					),
				),
			};
			setTemplates((current) => [...current, next]);
			setSelectedTemplateId(next.id);
			setTemplateModal(null);
		} catch (error) {
			console.error(error);
			setError(`Não foi possível salvar a template. Por favor, tente novamente.`);
		}
	};

	const updateTemplate = async (id: string, data: WorkoutTemplateFormDto) => {
		try {
			const response = await workoutTemplatesService.update(
				String(id),
				data satisfies UpdateWorkoutTemplateDto,
			);
			if (!response.data) {
				setError(
					response.error ||
						'Não foi possível salvar a template. Por favor, tente novamente.',
				);
				return;
			}
			const updated = {
				id: response.data.id,
				name: response.data.name,
				description: response.data.description,
				exercises: Array.from(
					new Set(
						response.data.activities.flatMap((a) =>
							a.exercise?.name ? [a.exercise.name] : [],
						),
					),
				),
			};
			setTemplates((current) =>
				current.map((item) => (item.id === id ? { ...item, ...updated } : item)),
			);
			setTemplateModal(null);
		} catch (error) {
			console.error(error);
			setError(`Não foi possível salvar a template. Por favor, tente novamente.`);
		}
	};

	const removeTemplate = async (
		template: workoutTemplatesService.WorkoutTemplateSummary,
	) => {
		try {
			const result = await workoutTemplatesService.remove(String(template.id));
			if (result.error) {
				setError(result.error);
				return;
			}

			setTemplates((current) => {
				const next = current.filter((item) => item.id !== template.id);
				if (selectedTemplateId === template.id)
					setSelectedTemplateId(next[0]?.id ?? null);
				return next;
			});
			setTemplateModal(null);
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
				<Button onClick={() => setTemplateModal({ mode: 'create' })}>
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
					selectedId={selectedTemplateId}
					query={query}
					actionsTemplateId={actionsTemplateId}
					onQueryChange={setQuery}
					onSelect={(template) => setSelectedTemplateId(template.id)}
					onToggleActions={(template) => {
						console.log('onToggleActions', template.id);
						setActionsTemplateId((id) => {
							const nextId = id === template.id ? null : template.id;
							console.log('next actionsTemplateId', nextId);
							return nextId;
						});
					}}
					onEdit={(template) =>
						setTemplateModal({ mode: 'edit', templateId: template.id })
					}
					onView={(template) =>
						setTemplateModal({ mode: 'view', templateId: template.id })
					}
					onRemove={(template) =>
						setTemplateModal({
							mode: 'remove',
							templateId: template.id,
							name: template.name,
						})
					}
				/>
				{templates.find((template) => template.id === selectedTemplateId) && (
					<TemplatePreview
						template={
							templates.find((template) => template.id === selectedTemplateId)!
						}
					/>
				)}
			</div>
			{templateModal?.mode === 'create' && (
				<CreateModal onClose={() => setTemplateModal(null)} onSave={saveTemplate} />
			)}
			{templateModal?.template && (
				<CreateModal
					key={`${templateModal.mode}-${templateModal.template.id}`}
					template={templateModal.template}
					mode={templateModal.mode === 'view' ? 'view' : 'edit'}
					onClose={() => setTemplateModal(null)}
					onSave={(workoutTemplate) =>
						updateTemplate(templateModal.template!.id, workoutTemplate)
					}
				/>
			)}
			{templateModal?.mode === 'remove' && (
				<Modal
					isOpen
					title="Remover template"
					description={`Deseja remover a template ${templateModal.name}? Esta ação não poderá ser desfeita.`}
					onClose={() => setTemplateModal(null)}
				>
					<div className="flex justify-end gap-3">
						<Button variant="outline" onClick={() => setTemplateModal(null)}>
							Cancelar
						</Button>
						<Button
							onClick={() =>
								removeTemplate(
									templates.find((item) => item.id === templateModal.templateId)!,
								)
							}
						>
							Remover
						</Button>
					</div>
				</Modal>
			)}
		</div>
	);
}
