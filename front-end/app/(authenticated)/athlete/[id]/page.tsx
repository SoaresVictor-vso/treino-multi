'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { RiAddLine, RiArrowLeftLine, RiEditLine, RiEyeLine, RiFileCopyLine, RiForbidLine } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import ErrorBox from '@/components/ui/ErrorBox';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import TrainingForm, { type TrainingFormValues } from '@/components/training/TrainingForm';
import AthleteWorkoutSchedule from '@/components/athlete/AthleteWorkoutSchedule';
import { workoutsService, type AthleteWorkout, type WorkoutDetail } from '@/gateway/services/workouts';
import {
	findAll as findWorkoutTemplates,
	findOne as findWorkoutTemplate,
	type WorkoutTemplateResponse,
	type WorkoutTemplateSummary,
} from '@/gateway/services/workout-templates';
import type { Exercise } from '@/gateway/services/parametro';
import { getSessionUser } from '@/lib/auth';
import { syncAnalysisSource } from '@/lib/offline-contingency';

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

function formValues(workout: WorkoutDetail): TrainingFormValues {
	return {
		name: workout.templateName,
		description: workout.templateDescription,
		scheduledDate: workout.scheduledDate ?? undefined,
		activities: workout.executions.map((execution) => ({
			exerciseId: execution.exerciseId,
			metric1: execution.prescribedMetric1 ?? 0,
			metric2: execution.prescribedMetric2 ?? 0,
			type1: 'v',
			type2: execution.metric2Type ?? 'v',
			pse: execution.prescribedPse ?? 0,
			setType: execution.setType,
			restDuration: execution.prescribedRestDuration ?? 0,
			note:
				workout.exerciseNotes.find(
					(note) => note.exerciseId === execution.exerciseId,
				)?.note ?? '',
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
			setType: 'padrao',
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
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] = useState<WorkoutDetail | null>(null);
	const [duplicating, setDuplicating] = useState<WorkoutDetail | null>(null);
	const [cancelTarget, setCancelTarget] = useState<AthleteWorkout | null>(null);
	const [saving, setSaving] = useState(false);
	const [templates, setTemplates] = useState<WorkoutTemplateSummary[]>([]);
	const [selectedTemplateId, setSelectedTemplateId] = useState('');
	const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplateResponse | null>(null);

	useEffect(() => {
		void params.then(async ({ id }) => {
			setAthleteId(id);
			const userId = getSessionUser()?.sub;
			if (userId && userId !== id) {
				try { await syncAnalysisSource(userId, id); }
				catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao sincronizar treinos.'); }
			}
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
		const userId = getSessionUser()?.sub;
		if (userId && userId !== athleteId) await syncAnalysisSource(userId, athleteId);
		const response = await workoutsService.findByAthlete(athleteId);
		if (!response.success || !response.data) setError(response.error || 'Não foi possível atualizar os treinos.');
		else setWorkouts(response.data.workouts);
	};
	const save = async (values: TrainingFormValues) => {
		if (!athleteId) return;
		setSaving(true);
		const response = editing
			? await workoutsService.updateDraft(editing.id, values)
			: await workoutsService.createForAthlete(athleteId, values);
		setSaving(false);
		if (!response.success) {
			setError(response.error || 'Não foi possível salvar o treino.');
			return;
		}
		setCreateOpen(false);
		setEditing(null);
		setDuplicating(null);
		await refresh();
	};
	const edit = async (workout: AthleteWorkout) => {
		const response = await workoutsService.findOne(workout.id);
		if (!response.success || !response.data) {
			setError(response.error || 'Não foi possível carregar o treino.');
			return;
		}
		setEditing(response.data);
	};
	const duplicate = async (workout: AthleteWorkout) => {
		const response = await workoutsService.findOne(workout.id);
		if (!response.success || !response.data) {
			setError(response.error || 'Não foi possível carregar o treino.');
			return;
		}
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
			{athleteId && <Link href={`/athlete/${athleteId}/analysis`} className="inline-flex rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 text-sm font-semibold text-primary-fixed hover:border-primary-fixed">Ver análise do atleta →</Link>}
			{loading ? <p className="text-on-surface-variant">Carregando treinos...</p> : error ? <ErrorBox message={error} /> : <AthleteWorkoutSchedule workouts={workouts} onChanged={() => void refresh()} />}
			<Modal isOpen={createOpen || !!editing || !!duplicating} title={editing ? 'Editar treino' : duplicating ? 'Duplicar treino' : 'Adicionar treino'} description={duplicating ? 'Revise o treino copiado antes de gerar uma nova versão independente.' : 'Defina exercícios e séries para o atleta.'} onClose={() => { if (!saving) { setCreateOpen(false); setEditing(null); setDuplicating(null); } }}>
				<div className="space-y-5">
					{!editing && !duplicating && (
						<Select
							label="Template ativa (opcional)"
							placeholder="Começar do zero"
							value={selectedTemplateId}
							onChange={(event) => void selectTemplate(event.target.value)}
							options={templates.map((template) => ({ value: template.id, label: template.name }))}
						/>
					)}
					<TrainingForm key={editing?.id ?? duplicating?.id ?? selectedTemplate?.id ?? 'new'} initialValues={editing ? formValues(editing) : duplicating ? formValues(duplicating) : selectedTemplate ? templateFormValues(selectedTemplate) : undefined} initialExercises={editing ? Array.from(new Map(editing.executions.map((execution) => [execution.exerciseId, execution.exercise])).values()) : duplicating ? Array.from(new Map(duplicating.executions.map((execution) => [execution.exerciseId, execution.exercise])).values()) : selectedTemplate ? templateExercises(selectedTemplate) : undefined} onSubmit={save} onCancel={() => { setCreateOpen(false); setEditing(null); setDuplicating(null); }} isSubmitting={saving} submitLabel={editing ? 'Salvar alterações' : duplicating ? 'Gerar treino duplicado' : 'Criar treino'} />
				</div>
			</Modal>
			<Modal isOpen={!!cancelTarget} title="Cancelar treino" description="Esta ação não pode ser desfeita." onClose={() => !saving && setCancelTarget(null)}>
				<div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button><Button disabled={saving} onClick={() => void cancel()}>{saving ? 'Cancelando...' : 'Cancelar treino'}</Button></div>
			</Modal>
		</section>
	);
}
