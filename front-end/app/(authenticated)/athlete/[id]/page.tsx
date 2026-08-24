'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { RiAddLine, RiArrowLeftLine, RiEditLine, RiEyeLine, RiFileCopyLine, RiForbidLine } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import ErrorBox from '@/components/ui/ErrorBox';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import TrainingForm, { type TrainingFormValues } from '@/components/training/TrainingForm';
import { workoutsService, type AthleteWorkout, type WorkoutDetail } from '@/gateway/services/workouts';
import {
	findAll as findWorkoutTemplates,
	findOne as findWorkoutTemplate,
	type WorkoutTemplateResponse,
	type WorkoutTemplateSummary,
} from '@/gateway/services/workout-templates';
import type { Exercise } from '@/gateway/services/parametro';

type Filter = 'future' | 'history';

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="group relative">
			{children}
			<span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-inverse-surface px-2 py-1 text-xs text-inverse-on-surface opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
				{label}
			</span>
		</div>
	);
}

function formatDate(value: string | null) {
	if (!value) return 'Sem data definida';
	return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
}

function isEditable(workout: AthleteWorkout) {
	return workout.status === 'pending' || workout.status === 'scheduled';
}

function statusLabel(status: AthleteWorkout['status']) {
	return {
		pending: 'Pendente',
		scheduled: 'Agendado',
		in_progress: 'Em andamento',
		completed: 'Finalizado',
		skipped: 'Pulado',
		cancelled: 'Cancelado',
	}[status];
}

function formValues(workout: WorkoutDetail): TrainingFormValues {
	return {
		name: workout.templateName,
		description: workout.templateDescription,
		activities: workout.executions.map((execution) => ({
			exerciseId: execution.exerciseId,
			metric1: execution.prescribedMetric1 ?? 0,
			metric2: execution.prescribedMetric2 ?? 0,
			type1: 'v',
			type2: execution.metric2Type ?? 'v',
			pse: execution.prescribedPse ?? 0,
			restDuration: execution.prescribedRestDuration ?? 0,
			note: '',
		})),
	};
}

function templateFormValues(template: WorkoutTemplateResponse): TrainingFormValues {
	return {
		name: template.name,
		description: template.description,
		activities: template.activities.map((activity) => ({
			exerciseId: activity.exerciseId,
			metric1: Number(activity.metric1 ?? 0),
			metric2: Number(activity.metric2 ?? 0),
			type1: 'v',
			type2: activity.type2 ?? 'v',
			pse: Number(activity.pse ?? 0),
			restDuration: activity.restDuration ?? 0,
			note: activity.note ?? '',
		})),
	};
}

function templateExercises(template: WorkoutTemplateResponse): Exercise[] {
	return Array.from(
		new Map(
			template.activities.flatMap((activity) =>
				activity.exercise
					? [[activity.exercise.id, {
							id: activity.exercise.id,
							name: activity.exercise.name,
							description: activity.exercise.description,
							metric_1: activity.exercise.metric1,
							metric_2: activity.exercise.metric2 ?? undefined,
						} satisfies Exercise]]
					: [],
			),
		).values(),
	);
}

export default function AthleteDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const [athleteId, setAthleteId] = useState<string | null>(null);
	const [athleteName, setAthleteName] = useState('');
	const [workouts, setWorkouts] = useState<AthleteWorkout[]>([]);
	const [filter, setFilter] = useState<Filter>('future');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] = useState<WorkoutDetail | null>(null);
	const [duplicating, setDuplicating] = useState<WorkoutDetail | null>(null);
	const [duplicateScheduledDate, setDuplicateScheduledDate] = useState('');
	const [editingScheduledDate, setEditingScheduledDate] = useState('');
	const [cancelTarget, setCancelTarget] = useState<AthleteWorkout | null>(null);
	const [saving, setSaving] = useState(false);
	const [templates, setTemplates] = useState<WorkoutTemplateSummary[]>([]);
	const [selectedTemplateId, setSelectedTemplateId] = useState('');
	const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplateResponse | null>(null);

	useEffect(() => {
		void params.then(({ id }) => {
			setAthleteId(id);
			workoutsService.findByAthlete(id).then((response) => {
				if (!response.success || !response.data)
					setError(response.error || 'Não foi possível carregar os treinos do atleta.');
				else {
					setAthleteName(response.data.athlete.name);
					setWorkouts(response.data.workouts);
				}
				setLoading(false);
			});
		});
	}, [params]);

	useEffect(() => {
		if (!createOpen || editing) return;
		void findWorkoutTemplates().then((response) => {
			if (!response.success) setError(response.error || 'Não foi possível carregar as templates ativas.');
			else setTemplates(response.data ?? []);
		});
	}, [createOpen, editing]);

	const refresh = async () => {
		if (!athleteId) return;
		const response = await workoutsService.findByAthlete(athleteId);
		if (!response.success || !response.data) setError(response.error || 'Não foi possível atualizar os treinos.');
		else setWorkouts(response.data.workouts);
	};
	const save = async (values: TrainingFormValues) => {
		if (!athleteId) return;
		setSaving(true);
		const response = editing
			? await workoutsService.updateDraft(editing.id, {
				...values,
				...(editingScheduledDate ? { scheduledDate: editingScheduledDate } : {}),
			})
			: await workoutsService.createForAthlete(athleteId, {
				...values,
				...(duplicating && duplicateScheduledDate
					? { scheduledDate: duplicateScheduledDate }
					: {}),
			});
		setSaving(false);
		if (!response.success) {
			setError(response.error || 'Não foi possível salvar o treino.');
			return;
		}
		setCreateOpen(false);
		setEditing(null);
		setDuplicating(null);
		setDuplicateScheduledDate('');
		setEditingScheduledDate('');
		await refresh();
	};
	const edit = async (workout: AthleteWorkout) => {
		const response = await workoutsService.findOne(workout.id);
		if (!response.success || !response.data) {
			setError(response.error || 'Não foi possível carregar o treino.');
			return;
		}
		setEditingScheduledDate(response.data.scheduledDate ?? '');
		setEditing(response.data);
	};
	const duplicate = async (workout: AthleteWorkout) => {
		const response = await workoutsService.findOne(workout.id);
		if (!response.success || !response.data) {
			setError(response.error || 'Não foi possível carregar o treino.');
			return;
		}
		setDuplicateScheduledDate(response.data.scheduledDate ?? '');
		setDuplicating(response.data);
	};
	const selectTemplate = async (templateId: string) => {
		setSelectedTemplateId(templateId);
		if (!templateId) {
			setSelectedTemplate(null);
			return;
		}
		const response = await findWorkoutTemplate(templateId);
		if (!response.success || !response.data) {
			setError(response.error || 'Não foi possível carregar a template.');
			return;
		}
		setSelectedTemplate(response.data);
	};
	const cancel = async () => {
		if (!cancelTarget) return;
		setSaving(true);
		const response = await workoutsService.cancel(cancelTarget.id);
		setSaving(false);
		if (!response.success) setError(response.error || 'Não foi possível cancelar o treino.');
		else {
			setCancelTarget(null);
			await refresh();
		}
	};
	const visible = workouts.filter((workout) =>
		filter === 'future'
			? ['pending', 'scheduled', 'in_progress'].includes(workout.status)
			: ['completed', 'cancelled', 'skipped'].includes(workout.status),
	);
	const inProgressWorkout = workouts.find(
		(workout) => workout.status === 'in_progress',
	);

	return (
		<section className="mx-auto w-full max-w-7xl space-y-6">
			<Link href="/athletes" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-fixed-dim hover:text-primary">
				<RiArrowLeftLine /> Voltar para atletas
			</Link>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="type-label-caps text-primary-fixed">Atleta</p>
					<h1 className="mt-1 text-3xl font-bold tracking-tight">{athleteName || 'Treinos do atleta'}</h1>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					{inProgressWorkout && (
						<Link href={`/training/${inProgressWorkout.id}`}>
							<Button className="w-full sm:w-auto" variant="outline"><RiEyeLine /> Acompanhar treino</Button>
						</Link>
					)}
					<Button className="w-full sm:w-auto" onClick={() => { setSelectedTemplateId(''); setSelectedTemplate(null); setCreateOpen(true); }}><RiAddLine /> Adicionar treino</Button>
				</div>
			</div>
			<div className="flex gap-2 border-b border-outline-variant">
				{([['future', 'Treinos futuros'], ['history', 'Treinos realizados']] as const).map(([value, label]) => (
					<button key={value} type="button" onClick={() => setFilter(value)} className={`border-b-2 px-3 py-3 text-sm font-semibold ${filter === value ? 'border-primary-fixed text-primary' : 'border-transparent text-on-surface-variant'}`}>{label}</button>
				))}
			</div>
			{loading ? <p className="text-on-surface-variant">Carregando treinos...</p> : error ? <ErrorBox message={error} /> : visible.length === 0 ? <p className="rounded-lg border border-outline-variant bg-surface-container-low p-5 text-on-surface-variant">Nenhum treino nesta lista.</p> : (
				<div className="space-y-3">
					{visible.map((workout) => (
						<article key={workout.id} className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
							<div><p className="font-semibold">{workout.templateName}</p><p className="mt-1 text-sm text-on-surface-variant">{workout.templateDescription || formatDate(workout.scheduledDate)}</p></div>
							<div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-surface-variant px-2 py-1 text-xs font-bold text-on-surface-variant">{statusLabel(workout.status)}</span><ActionTooltip label="Visualizar treino"><Link href={`/training/${workout.id}`} aria-label="Visualizar treino" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition-colors hover:border-primary-fixed-dim/40 hover:bg-surface-variant/60 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim/30"><RiEyeLine size={18} /></Link></ActionTooltip><ActionTooltip label="Duplicar treino"><Button size="icon" variant="outline" aria-label="Duplicar treino" onClick={() => void duplicate(workout)}><RiFileCopyLine size={18} /></Button></ActionTooltip>{isEditable(workout) && <><ActionTooltip label="Editar treino"><Button size="icon" variant="outline" aria-label="Editar treino" onClick={() => void edit(workout)}><RiEditLine size={18} /></Button></ActionTooltip><ActionTooltip label="Cancelar treino"><Button size="icon" variant="ghost" aria-label="Cancelar treino" onClick={() => setCancelTarget(workout)}><RiForbidLine size={18} /></Button></ActionTooltip></>}</div>
						</article>
					))}
				</div>
			)}
			<Modal isOpen={createOpen || !!editing || !!duplicating} title={editing ? 'Editar treino' : duplicating ? 'Duplicar treino' : 'Adicionar treino'} description={duplicating ? 'Revise o treino copiado antes de gerar uma nova versão independente.' : 'Defina exercícios e séries para o atleta.'} onClose={() => { if (!saving) { setCreateOpen(false); setEditing(null); setDuplicating(null); setDuplicateScheduledDate(''); setEditingScheduledDate(''); } }}>
				<div className="space-y-5">
					{duplicating && <Input label="Data do treino (opcional)" type="date" value={duplicateScheduledDate} onChange={(event) => setDuplicateScheduledDate(event.target.value)} hint="Com uma data definida, o novo treino será criado como agendado." />}
					{editing && <Input label="Data do treino (opcional)" type="date" value={editingScheduledDate} onChange={(event) => setEditingScheduledDate(event.target.value)} hint="Altere a data para reagendar este treino." />}
					{!editing && !duplicating && (
						<Select
							label="Template ativa (opcional)"
							placeholder="Começar do zero"
							value={selectedTemplateId}
							onChange={(event) => void selectTemplate(event.target.value)}
							options={templates.map((template) => ({ value: template.id, label: template.name }))}
						/>
					)}
					<TrainingForm key={editing?.id ?? duplicating?.id ?? selectedTemplate?.id ?? 'new'} initialValues={editing ? formValues(editing) : duplicating ? formValues(duplicating) : selectedTemplate ? templateFormValues(selectedTemplate) : undefined} initialExercises={editing ? Array.from(new Map(editing.executions.map((execution) => [execution.exerciseId, execution.exercise])).values()) : duplicating ? Array.from(new Map(duplicating.executions.map((execution) => [execution.exerciseId, execution.exercise])).values()) : selectedTemplate ? templateExercises(selectedTemplate) : undefined} onSubmit={save} onCancel={() => { setCreateOpen(false); setEditing(null); setDuplicating(null); setDuplicateScheduledDate(''); setEditingScheduledDate(''); }} isSubmitting={saving} submitLabel={editing ? 'Salvar alterações' : duplicating ? 'Gerar treino duplicado' : 'Criar treino'} />
				</div>
			</Modal>
			<Modal isOpen={!!cancelTarget} title="Cancelar treino" description="Esta ação não pode ser desfeita." onClose={() => !saving && setCancelTarget(null)}>
				<div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button><Button disabled={saving} onClick={() => void cancel()}>{saving ? 'Cancelando...' : 'Cancelar treino'}</Button></div>
			</Modal>
		</section>
	);
}
