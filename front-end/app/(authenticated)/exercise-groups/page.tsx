'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiEditLine, RiSearchLine } from 'react-icons/ri';
import { exerciseGroupsService, type ExerciseGroup } from '@/api/services/exercise-groups';
import { exercisesService, type ExerciseParameter } from '@/api/services/parametro/exercises';
import { metricsService, type Metric } from '@/api/services/parametro/metrics';
import { TenantService } from '@/api/services/tenant';
import type { TenantListItemDto } from '@/api/dto/tenant/list-tenant.dto';
import { getSessionUser } from '@/lib/auth';
import { Role } from '@/lib/roles';
import Button from '@/components/ui/Button';
import ErrorBox from '@/components/ui/ErrorBox';
import Input from '@/components/ui/Input';
import MetricCard from '@/components/ui/MetricCard';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

type GroupForm = {
	id?: number;
	name: string;
	tenantId: string;
	metric1Id: string;
	metric2Id: string;
	exerciseIds: number[];
	originalExerciseIds: number[];
};

const emptyForm = (): GroupForm => ({
	name: '', tenantId: '', metric1Id: '', metric2Id: '', exerciseIds: [], originalExerciseIds: [],
});

export default function ExerciseGroupsPage() {
	const [groups, setGroups] = useState<ExerciseGroup[]>([]);
	const [metrics, setMetrics] = useState<Metric[]>([]);
	const [exercises, setExercises] = useState<ExerciseParameter[]>([]);
	const [tenants, setTenants] = useState<TenantListItemDto[]>([]);
	const [query, setQuery] = useState('');
	const [form, setForm] = useState<GroupForm | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const sessionUser = getSessionUser();
	const isOrgActor = !!sessionUser?.roles.some((role) => [Role.ORG_ADMIN, Role.ORG_SUPPORT].includes(role));

	const load = useCallback(async () => {
		setLoading(true);
		const [groupsResult, metricList, exerciseList] = await Promise.all([
			exerciseGroupsService.findAll(), metricsService.search(), exercisesService.syncCatalog(),
		]);
		if (!groupsResult.success || !groupsResult.data) setError(groupsResult.error || 'Não foi possível carregar os grupos.');
		else { setGroups(groupsResult.data); setError(null); }
		setMetrics(metricList);
		setExercises(exerciseList);
		setLoading(false);
	}, []);

	useEffect(() => { void Promise.resolve().then(load); }, [load]);
	useEffect(() => {
		if (!isOrgActor) return;
		void new TenantService().findMultiple({ filter: 'all', includeInactive: false }).then((result) => {
			if (result.success && result.data) setTenants(result.data);
		});
	}, [isOrgActor]);

	const visibleGroups = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase();
		return normalized ? groups.filter((group) => group.name.toLocaleLowerCase().includes(normalized)) : groups;
	}, [groups, query]);
	const selectableExercises = useMemo(() => form ? exercises.filter((exercise) =>
		(!isOrgActor || !exercise.tenantId || exercise.tenantId === form.tenantId) &&
		exercise.metric1Id === Number(form.metric1Id) && (exercise.metric2Id ?? null) === (form.metric2Id ? Number(form.metric2Id) : null),
	) : [], [exercises, form, isOrgActor]);

	const openEdit = async (group: ExerciseGroup) => {
		const result = await exerciseGroupsService.findExercises(group.id);
		if (!result.success || !result.data) { setError(result.error || 'Não foi possível carregar os exercícios do grupo.'); return; }
		const ids = result.data.map((item) => item.exerciseId);
		setForm({ id: group.id, name: group.name, tenantId: group.tenantId, metric1Id: String(group.metric1Id), metric2Id: group.metric2Id ? String(group.metric2Id) : '', exerciseIds: ids, originalExerciseIds: ids });
	};

	const save = async () => {
		if (!form || !form.name.trim() || !form.metric1Id || form.exerciseIds.length === 0 || (isOrgActor && !form.tenantId)) {
			setError('Informe nome, tenant, métricas e ao menos um exercício.'); return;
		}
		setSaving(true); setError(null);
		const metric1Id = Number(form.metric1Id);
		const metric2Id = form.metric2Id ? Number(form.metric2Id) : null;
		const result = form.id
			? await exerciseGroupsService.update(form.id, {
				name: form.name.trim(), metric1Id, metric2Id,
				exerciseIdsToAdd: form.exerciseIds.filter((id) => !form.originalExerciseIds.includes(id)),
				exerciseIdsToRemove: form.originalExerciseIds.filter((id) => !form.exerciseIds.includes(id)),
			})
			: await exerciseGroupsService.create({ name: form.name.trim(), ...(isOrgActor ? { tenantId: form.tenantId } : {}), metric1Id, metric2Id, exerciseIds: form.exerciseIds });
		if (!result.success) setError(result.error || 'Não foi possível salvar o grupo.');
		else { setForm(null); await load(); }
		setSaving(false);
	};

	const remove = async (group: ExerciseGroup) => {
		if (!window.confirm(`Remover o grupo “${group.name}”?`)) return;
		const result = await exerciseGroupsService.remove(group.id);
		if (!result.success) setError(result.error || 'Não foi possível remover o grupo.'); else await load();
	};

	const changeMetric = (key: 'metric1Id' | 'metric2Id', value: string) => setForm((current) => current ? { ...current, [key]: value, exerciseIds: [] } : current);
	const toggleExercise = (id: number) => setForm((current) => current ? { ...current, exerciseIds: current.exerciseIds.includes(id) ? current.exerciseIds.filter((item) => item !== id) : [...current.exerciseIds, id] } : current);

	return <div className="mx-auto max-w-[1440px] space-y-7 p-4 md:p-8">
		<header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
			<div><p className="type-label-caps text-secondary-fixed-dim">Catálogo de exercícios</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-primary">Grupos de exercícios</h1><p className="mt-2 text-on-surface-variant">Agrupe exercícios com as mesmas métricas para registrar e acompanhar referências.</p></div>
			<Button onClick={() => setForm(emptyForm())}><RiAddLine size={20} /> Novo grupo</Button>
		</header>
		<section className="grid gap-3 sm:grid-cols-3"><MetricCard label="Grupos" value={groups.length} description="Grupos disponíveis no tenant." /><MetricCard label="Métricas" value={new Set(groups.map((group) => `${group.metric1Id}-${group.metric2Id ?? ''}`)).size} description="Combinações em uso." /><MetricCard label="Exercícios" value={exercises.length} description="Exercícios disponíveis no catálogo." /></section>
		{error && <ErrorBox message={error} />}
		<div className="flex max-w-xl items-center rounded-xl border border-outline-variant bg-surface-container-high px-3"><RiSearchLine className="text-on-surface-variant" size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar grupo" className="w-full bg-transparent px-3 py-3 text-primary outline-none" /></div>
		<div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
			<div className="hidden grid-cols-[minmax(200px,1fr)_180px_180px_150px] gap-4 border-b border-outline-variant px-5 py-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant md:grid"><span>Grupo</span><span>Métrica principal</span><span>Métrica secundária</span><span>Ações</span></div>
			{loading ? <p className="p-6 text-sm text-on-surface-variant">Carregando grupos...</p> : visibleGroups.length === 0 ? <p className="p-6 text-sm text-on-surface-variant">Nenhum grupo encontrado.</p> : visibleGroups.map((group) => <div key={group.id} className="grid gap-3 border-b border-outline-variant/70 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(200px,1fr)_180px_180px_150px] md:items-center md:gap-4"><p className="font-semibold text-primary">{group.name}</p><span className="text-sm text-on-surface-variant">{group.metric1.name} ({group.metric1.symbol})</span><span className="text-sm text-on-surface-variant">{group.metric2 ? `${group.metric2.name} (${group.metric2.symbol})` : '—'}</span><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Editar ${group.name}`} onClick={() => void openEdit(group)}><RiEditLine size={18} /></Button><Button size="icon" variant="ghost" aria-label={`Remover ${group.name}`} onClick={() => void remove(group)}><RiDeleteBinLine size={18} /></Button></div></div>)}
		</div>
		<Modal isOpen={!!form} title={form?.id ? 'Editar grupo de exercícios' : 'Novo grupo de exercícios'} description="Todos os exercícios do grupo precisam possuir as mesmas métricas." onClose={() => setForm(null)}>
			{form && <div className="space-y-5"><Input label="Nome do grupo" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
				{isOrgActor && <Select label="Tenant" value={form.tenantId} onChange={(event) => setForm({ ...form, tenantId: event.target.value })} placeholder="Selecione o tenant" options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.tradeName || tenant.name }))} />}
				<div className="grid gap-4 md:grid-cols-2"><Select label="Métrica principal" value={form.metric1Id} onChange={(event) => changeMetric('metric1Id', event.target.value)} placeholder="Selecione a métrica" options={metrics.map((metric) => ({ value: String(metric.id), label: `${metric.name} (${metric.symbol})` }))} /><Select label="Métrica secundária" value={form.metric2Id} onChange={(event) => changeMetric('metric2Id', event.target.value)} placeholder="Nenhuma" canClear options={metrics.filter((metric) => String(metric.id) !== form.metric1Id).map((metric) => ({ value: String(metric.id), label: `${metric.name} (${metric.symbol})` }))} /></div>
				<div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold text-primary">Exercícios ({form.exerciseIds.length})</p><p className="text-xs text-on-surface-variant">Filtrados pelas métricas escolhidas</p></div><div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-outline-variant p-2">{!form.metric1Id ? <p className="p-3 text-sm text-on-surface-variant">Escolha as métricas para listar os exercícios compatíveis.</p> : selectableExercises.length === 0 ? <p className="p-3 text-sm text-on-surface-variant">Nenhum exercício compatível encontrado.</p> : selectableExercises.map((exercise) => <label key={exercise.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-variant"><input type="checkbox" checked={form.exerciseIds.includes(Number(exercise.id))} onChange={() => toggleExercise(Number(exercise.id))} className="h-4 w-4 accent-primary-container" /><span><span className="block text-sm font-medium text-primary">{exercise.name}</span>{exercise.description && <span className="block text-xs text-on-surface-variant">{exercise.description}</span>}</span></label>)}</div></div>
				<div className="flex justify-end gap-3 border-t border-outline-variant pt-5"><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Salvando...' : 'Salvar grupo'}</Button></div>
			</div>}
		</Modal>
	</div>;
}
