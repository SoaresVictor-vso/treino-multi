'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	RiAddLine,
	RiDeleteBinLine,
	RiEditLine,
	RiSearchLine,
} from 'react-icons/ri';
import {
	exerciseGroupsService,
	type ExerciseGroup,
} from '@/gateway/services/exercise-groups';
import {
	exercisesService,
	type ExerciseParameter,
} from '@/gateway/services/parametro/exercises';
import {
	metricsService,
	type Metric,
} from '@/gateway/services/parametro/metrics';
import type { Exercise } from '@/gateway/services/parametro';
import { TenantService } from '@/gateway/services/tenant';
import type { TenantListItemDto } from '@/gateway/dto/tenant/list-tenant.dto';
import { getSessionUser } from '@/lib/auth';
import { Role } from '@/lib/roles';
import Button from '@/components/ui/Button';
import ErrorBox from '@/components/ui/ErrorBox';
import Input from '@/components/ui/Input';
import MetricCard from '@/components/ui/MetricCard';
import Modal from '@/components/ui/Modal';
import ExercisePicker from '@/components/shared/ExercisePicker';
import Select from '@/components/ui/Select';

type GroupForm = {
	id?: number;
	name: string;
	tenantId: string;
	selectedExercises: Exercise[];
	originalExerciseIds: number[];
	lockedMetrics?: { metric1Id: number; metric2Id: number | null };
};

const emptyForm = (): GroupForm => ({
	name: '',
	tenantId: '',
	selectedExercises: [],
	originalExerciseIds: [],
});

export default function ExerciseGroupsPage() {
	const [groups, setGroups] = useState<ExerciseGroup[]>([]);
	const [metrics, setMetrics] = useState<Metric[]>([]);
	const [exercises, setExercises] = useState<ExerciseParameter[]>([]);
	const [tenants, setTenants] = useState<TenantListItemDto[]>([]);
	const [query, setQuery] = useState('');
	const [form, setForm] = useState<GroupForm | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const sessionUser = getSessionUser();
	const isOrgActor = !!sessionUser?.roles.some((role) =>
		[Role.ORG_ADMIN, Role.ORG_SUPPORT].includes(role),
	);
	const listsAllTenants = !sessionUser?.tenantId;

	const load = useCallback(async () => {
		setLoading(true);
		const [groupsResult, metricList, exerciseList] = await Promise.all([
			exerciseGroupsService.findAll(),
			metricsService.search(),
			exercisesService.syncCatalog(),
		]);
		if (!groupsResult.success || !groupsResult.data)
			setError(groupsResult.error || 'Não foi possível carregar os grupos.');
		else {
			setGroups(groupsResult.data);
			setError(null);
		}
		setMetrics(metricList);
		setExercises(exerciseList);
		setLoading(false);
	}, []);

	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);
	useEffect(() => {
		if (!isOrgActor) return;
		void new TenantService()
			.findMultiple({ filter: 'all', includeInactive: false })
			.then((result) => {
				if (result.success && result.data) setTenants(result.data);
			});
	}, [isOrgActor]);

	const visibleGroups = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase();
		return normalized
			? groups.filter((group) =>
					group.name.toLocaleLowerCase().includes(normalized),
				)
			: groups;
	}, [groups, query]);
	const tenantNameById = useMemo(
		() =>
			new Map(
				tenants.map((tenant) => [tenant.id, tenant.tradeName || tenant.name]),
			),
		[tenants],
	);
	const openEdit = async (group: ExerciseGroup) => {
		setFormError(null);
		const result = await exerciseGroupsService.findExercises(group.id);
		if (!result.success || !result.data) {
			setError(
				result.error || 'Não foi possível carregar os exercícios do grupo.',
			);
			return;
		}
		const ids = result.data.map((item) => item.exerciseId);
		const metricById = new Map(metrics.map((metric) => [metric.id, metric]));
		const exerciseById = new Map(
			exercises.map((exercise) => [Number(exercise.id), exercise]),
		);
		const selectedExercises = ids.flatMap((id) => {
			const exercise = exerciseById.get(id);
			const metric1 = exercise && metricById.get(exercise.metric1Id);
			if (!exercise || !metric1) return [];
			const metric2 = exercise.metric2Id
				? metricById.get(exercise.metric2Id)
				: undefined;
			return [
				{
					id,
					name: exercise.name,
					description: exercise.description,
					metric_1: metric1,
					...(metric2 ? { metric_2: metric2 } : {}),
					...(exercise.visualUrl ? { visual_url: exercise.visualUrl } : {}),
				},
			];
		});
		setForm({
			id: group.id,
			name: group.name,
			tenantId: group.tenantId,
			selectedExercises,
			originalExerciseIds: ids,
			lockedMetrics: { metric1Id: group.metric1Id, metric2Id: group.metric2Id },
		});
	};

	const save = async () => {
		if (
			!form ||
			!form.name.trim() ||
			form.selectedExercises.length === 0 ||
			(isOrgActor && !form.tenantId)
		) {
			setFormError('Informe nome, tenant e ao menos um exercício.');
			return;
		}
		setSaving(true);
		setFormError(null);
		const exerciseIds = form.selectedExercises.map((exercise) => exercise.id);
		const result = form.id
			? await exerciseGroupsService.update(form.id, {
					name: form.name.trim(),
					exerciseIdsToAdd: exerciseIds.filter(
						(id) => !form.originalExerciseIds.includes(id),
					),
					exerciseIdsToRemove: form.originalExerciseIds.filter(
						(id) => !exerciseIds.includes(id),
					),
				})
			: await exerciseGroupsService.create({
					name: form.name.trim(),
					...(isOrgActor ? { tenantId: form.tenantId } : {}),
					metric1Id: form.selectedExercises[0].metric_1.id,
					metric2Id: form.selectedExercises[0].metric_2?.id ?? null,
					exerciseIds,
				});
		if (!result.success)
			setFormError(result.error || 'Não foi possível salvar o grupo.');
		else {
			setForm(null);
			await load();
		}
		setSaving(false);
	};

	const remove = async (group: ExerciseGroup) => {
		if (!window.confirm(`Remover o grupo “${group.name}”?`)) return;
		const result = await exerciseGroupsService.remove(group.id);
		if (!result.success)
			setError(result.error || 'Não foi possível remover o grupo.');
		else await load();
	};

	const selectedMetrics = form?.selectedExercises[0];
	const displayedMetrics =
		selectedMetrics ??
		(form?.lockedMetrics
			? {
					metric_1: metrics.find(
						(metric) => metric.id === form.lockedMetrics?.metric1Id,
					),
					metric_2:
						form.lockedMetrics.metric2Id == null
							? undefined
							: metrics.find((metric) => metric.id === form.lockedMetrics?.metric2Id),
				}
			: null);

	return (
		<div className="mx-auto max-w-[1440px] space-y-7 p-4 md:p-8">
			<header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
				<div>
					<p className="type-label-caps text-secondary-fixed-dim">
						Catálogo de exercícios
					</p>
					<h1 className="mt-2 text-3xl font-bold tracking-tight text-primary">
						Grupos de exercícios
					</h1>
					<p className="mt-2 text-on-surface-variant">
						Agrupe exercícios com as mesmas métricas para registrar e acompanhar
						referências.
					</p>
				</div>
				<Button
					onClick={() => {
						setFormError(null);
						setForm(emptyForm());
					}}
				>
					<RiAddLine size={20} /> Novo grupo
				</Button>
			</header>
			<section className="grid gap-3 sm:grid-cols-3">
				<MetricCard
					label="Grupos"
					value={groups.length}
					description="Grupos disponíveis no tenant."
				/>
				<MetricCard
					label="Métricas"
					value={
						new Set(
							groups.map((group) => `${group.metric1Id}-${group.metric2Id ?? ''}`),
						).size
					}
					description="Combinações em uso."
				/>
				<MetricCard
					label="Exercícios"
					value={exercises.length}
					description="Exercícios disponíveis no catálogo."
				/>
			</section>
			{error && <ErrorBox message={error} />}
			<div className="flex max-w-xl items-center rounded-xl border border-outline-variant bg-surface-container-high px-3">
				<RiSearchLine className="text-on-surface-variant" size={20} />
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Buscar grupo"
					className="w-full bg-transparent px-3 py-3 text-primary outline-none"
				/>
			</div>
			<div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
				<div className="hidden grid-cols-[minmax(200px,1fr)_180px_180px_150px] gap-4 border-b border-outline-variant px-5 py-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant md:grid">
					<span>Grupo</span>
					<span>Métrica principal</span>
					<span>Métrica secundária</span>
					<span>Ações</span>
				</div>
				{loading ? (
					<p className="p-6 text-sm text-on-surface-variant">Carregando grupos...</p>
				) : visibleGroups.length === 0 ? (
					<p className="p-6 text-sm text-on-surface-variant">
						Nenhum grupo encontrado.
					</p>
				) : (
					visibleGroups.map((group) => (
						<div
							key={group.id}
							className="grid gap-3 border-b border-outline-variant/70 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(200px,1fr)_180px_180px_150px] md:items-center md:gap-4"
						>
							<div>
								<p className="font-semibold text-primary">{group.name}</p>
								{listsAllTenants && (
									<p className="mt-1 text-xs text-on-surface-variant">
										{tenantNameById.get(group.tenantId) || 'Tenant não identificado'}
									</p>
								)}
							</div>
							<span className="text-sm text-on-surface-variant">
								{group.metric1.name} ({group.metric1.symbol})
							</span>
							<span className="text-sm text-on-surface-variant">
								{group.metric2
									? `${group.metric2.name} (${group.metric2.symbol})`
									: '—'}
							</span>
							<div className="flex gap-1">
								<Button
									size="icon"
									variant="ghost"
									aria-label={`Editar ${group.name}`}
									onClick={() => void openEdit(group)}
								>
									<RiEditLine size={18} />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									aria-label={`Remover ${group.name}`}
									onClick={() => void remove(group)}
								>
									<RiDeleteBinLine size={18} />
								</Button>
							</div>
						</div>
					))
				)}
			</div>
			<Modal
				isOpen={!!form}
				title={form?.id ? 'Editar grupo de exercícios' : 'Novo grupo de exercícios'}
				description="Todos os exercícios do grupo precisam possuir as mesmas métricas."
				onClose={() => setForm(null)}
			>
				{form && (
					<div className="space-y-5">
						{formError && <ErrorBox message={formError} />}
						<Input
							label="Nome do grupo"
							value={form.name}
							onChange={(event) => setForm({ ...form, name: event.target.value })}
							required
						/>
						{isOrgActor && (
							<Select
								label="Tenant"
								value={form.tenantId}
								onChange={(event) =>
									setForm({
										...form,
										tenantId: event.target.value,
										selectedExercises: [],
									})
								}
								placeholder="Selecione o tenant"
								options={tenants.map((tenant) => ({
									value: tenant.id,
									label: tenant.tradeName || tenant.name,
								}))}
							/>
						)}
						<div className="rounded-xl border border-outline-variant p-4">
							<div className="flex items-center justify-between gap-4">
								<div>
									<p className="text-sm font-semibold text-primary">
										Exercícios ({form.selectedExercises.length})
									</p>
									<p className="mt-1 text-xs text-on-surface-variant">
										{form.id
											? 'As métricas do grupo não podem ser alteradas.'
											: 'O primeiro exercício define as métricas do grupo.'}
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									onClick={() => setPickerOpen(true)}
								>
									Selecionar exercícios
								</Button>
							</div>
							{displayedMetrics?.metric_1 && (
								<p className="mt-3 text-sm text-on-surface-variant">
									Métricas: {displayedMetrics.metric_1.name} (
									{displayedMetrics.metric_1.symbol})
									{displayedMetrics.metric_2
										? ` · ${displayedMetrics.metric_2.name} (${displayedMetrics.metric_2.symbol})`
										: ''}
								</p>
							)}
						</div>
						<div className="flex justify-end gap-3 border-t border-outline-variant pt-5">
							<Button variant="ghost" onClick={() => setForm(null)}>
								Cancelar
							</Button>
							<Button onClick={() => void save()} disabled={saving}>
								{saving ? 'Salvando...' : 'Salvar grupo'}
							</Button>
						</div>
					</div>
				)}
			</Modal>
			{form && pickerOpen && (
				<ExercisePicker
					selected={form.selectedExercises}
					onChange={(selectedExercises) =>
						setForm((current) =>
							current ? { ...current, selectedExercises } : current,
						)
					}
					onClose={() => setPickerOpen(false)}
					matchMetricsOfFirstSelection
					requiredMetrics={form.lockedMetrics}
					filterExercise={(exercise) =>
						!isOrgActor ||
						!form.tenantId ||
						exercises.some(
							(item) =>
								Number(item.id) === exercise.id &&
								(!item.tenantId || item.tenantId === form.tenantId),
						)
					}
				/>
			)}
		</div>
	);
}
