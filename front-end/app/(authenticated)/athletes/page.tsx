'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
	RiAddLine,
	RiCalendarScheduleLine,
	RiMedalLine,
	RiSearchLine,
	RiUserLine,
} from 'react-icons/ri';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import ErrorBox from '@/components/ui/ErrorBox';
import MetricCard from '@/components/ui/MetricCard';
import {
	Athlete,
	AthleteService,
	TrainerOption,
} from '@/gateway/services/athlete';
import { workoutsService } from '@/gateway/services/workouts';
import {
	findAll as findWorkoutTemplates,
	type WorkoutTemplateSummary,
} from '@/gateway/services/workout-templates';
import { getSessionUser } from '@/lib/auth';
import { Role } from '@/lib/roles';
import PersonalRecordModal from '@/components/shared/PersonalRecordModal';
import Input from '@/components/ui/Input';
import {
	personalRecordsService,
	type PersonalRecord,
} from '@/gateway/services/personal-records';
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

const service = new AthleteService();
const NO_TRAINER_VALUE = '__none__';

function addDays(date: string, days: number) {
	const result = new Date(`${date}T00:00:00Z`);
	result.setUTCDate(result.getUTCDate() + days);
	return result.toISOString().slice(0, 10);
}

export default function AthletesPage() {
	const [canManage, setCanManage] = useState(false);
	const [canRegisterPersonalRecord, setCanRegisterPersonalRecord] =
		useState(false);
	const [athletes, setAthletes] = useState<Athlete[]>([]);
	const [trainers, setTrainers] = useState<TrainerOption[]>([]);
	const [search, setSearch] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
	const [associationPanelOpen, setAssociationPanelOpen] = useState(false);
	const [workoutPanelOpen, setWorkoutPanelOpen] = useState(false);
	const [trainerId, setTrainerId] = useState('');
	const [workoutTemplates, setWorkoutTemplates] = useState<
		WorkoutTemplateSummary[]
	>([]);
	const [workoutTemplateId, setWorkoutTemplateId] = useState('');
	const [workoutScheduledDate, setWorkoutScheduledDate] = useState('');
	const [startDate, setStartDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [savingAssociation, setSavingAssociation] = useState(false);
	const [savingWorkout, setSavingWorkout] = useState(false);
	const minimumStartDate = new Date().toISOString().slice(0, 10);
	const maximumStartDate = addDays(minimumStartDate, 60);
	const [personalRecordAthlete, setPersonalRecordAthlete] =
		useState<Athlete | null>(null);
	const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
	const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([]);
	const [recordExercises, setRecordExercises] = useState<ExerciseParameter[]>(
		[],
	);
	const [recordMetrics, setRecordMetrics] = useState<Metric[]>([]);
	const [recordReferenceType, setRecordReferenceType] = useState<
		'group' | 'exercise'
	>('group');
	const [recordReferenceId, setRecordReferenceId] = useState('');
	const [recordValue, setRecordValue] = useState('');
	const [recordMeasuredAt, setRecordMeasuredAt] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [savingPersonalRecord, setSavingPersonalRecord] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		const result = await service.findAthletes();
		if (!result.success || !result.data) {
			setError(result.error || 'Não foi possível carregar os atletas.');
		} else {
			setAthletes(result.data);
			setError(null);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		void Promise.resolve().then(load);
	}, [load]);
	useEffect(() => {
		void Promise.resolve().then(() => {
			const sessionUser = getSessionUser();
			setCanManage(
				!!sessionUser?.roles.some((role) =>
					[Role.ORG_ADMIN, Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(
						role,
					),
				),
			);
			setCanRegisterPersonalRecord(
				!!sessionUser?.roles.some((role) =>
					[Role.ORG_ADMIN, Role.ORG_SUPPORT, Role.TENANT_ADMIN].includes(role),
				),
			);
		});
	}, []);

	const visibleAthletes = useMemo(() => {
		const term = search.trim().toLocaleLowerCase();
		return term
			? athletes.filter((athlete) =>
					athlete.person.name.toLocaleLowerCase().includes(term),
				)
			: athletes;
	}, [athletes, search]);

	const openAssociation = async () => {
		if (selectedAthleteIds.length === 0) return;
		const result = await service.findTrainers();
		if (!result.success || !result.data) {
			setError(result.error || 'Não foi possível carregar os treinadores.');
			return;
		}
		setTrainers(result.data);
		setWorkoutPanelOpen(false);
		setAssociationPanelOpen(true);
	};

	const openWorkoutAssignment = async () => {
		if (selectedAthleteIds.length === 0) return;
		const result = await findWorkoutTemplates();
		if (!result.success || !result.data) {
			setError(
				result.error || 'Não foi possível carregar as templates de treino.',
			);
			return;
		}
		setWorkoutTemplates(result.data);
		setAssociationPanelOpen(false);
		setWorkoutPanelOpen(true);
	};

	const saveAssociation = async () => {
		if (
			!trainerId ||
			!startDate ||
			startDate < minimumStartDate ||
			startDate > maximumStartDate
		) {
			setError(
				'Selecione um treinador e informe uma data entre hoje e os próximos 60 dias.',
			);
			return;
		}
		setSavingAssociation(true);
		setError(null);
		if (trainerId === NO_TRAINER_VALUE) {
			const selectedAthletes = athletes.filter(
				(athlete) =>
					selectedAthleteIds.includes(athlete.id) && athlete.activeAssociation,
			);
			const results = await Promise.all(
				selectedAthletes.map((athlete) =>
					service.endAssociation(athlete.activeAssociation!.id),
				),
			);
			const failed = results.find((result) => !result.success);
			if (failed)
				setError(failed.error || 'Não foi possível desassociar os atletas.');
			else {
				setSelectedAthleteIds([]);
				setAssociationPanelOpen(false);
				setTrainerId('');
				await load();
			}
		} else {
			const result = await service.associateMany(
				selectedAthleteIds,
				trainerId,
				startDate,
			);
			if (!result.success) {
				setError(result.error || 'Não foi possível criar as associações.');
			} else {
				setSelectedAthleteIds([]);
				setAssociationPanelOpen(false);
				setTrainerId('');
				await load();
			}
		}
		setSavingAssociation(false);
	};

	const saveWorkoutAssignment = async () => {
		if (!workoutTemplateId) {
			setError('Selecione uma template de treino.');
			return;
		}
		setSavingWorkout(true);
		setError(null);
		const result = await workoutsService.generateFromTemplate(
			selectedAthleteIds,
			workoutTemplateId,
			workoutScheduledDate || undefined,
		);
		if (!result.success) {
			setError(result.error || 'Não foi possível associar o treino aos atletas.');
		} else {
			setSelectedAthleteIds([]);
			setWorkoutPanelOpen(false);
			setWorkoutTemplateId('');
			setWorkoutScheduledDate('');
		}
		setSavingWorkout(false);
	};

	const openPersonalRecord = async (athlete: Athlete) => {
		setError(null);
		const [recordsResult, groupsResult, exercisesResult, metricList] =
			await Promise.all([
				personalRecordsService.findByAthlete(athlete.id),
				exerciseGroupsService.findAll(),
				exercisesService.syncCatalog(),
				metricsService.search(),
			]);
		if (!recordsResult.success || !groupsResult.success) {
			setError(
				recordsResult.error ||
					groupsResult.error ||
					'Não foi possível carregar os dados de RP.',
			);
			return;
		}
		setPersonalRecords(recordsResult.data ?? []);
		setExerciseGroups(
			(groupsResult.data ?? []).filter(
				(group) => group.tenantId === athlete.tenantId,
			),
		);
		setRecordExercises(
			exercisesResult.filter(
				(exercise) => !exercise.tenantId || exercise.tenantId === athlete.tenantId,
			),
		);
		setRecordMetrics(metricList);
		setRecordReferenceType('group');
		setRecordReferenceId('');
		setRecordValue('');
		setRecordMeasuredAt(new Date().toISOString().slice(0, 10));
		setPersonalRecordAthlete(athlete);
	};

	const savePersonalRecord = async () => {
		if (
			!personalRecordAthlete ||
			!recordReferenceId ||
			!recordValue ||
			Number(recordValue) <= 0 ||
			!recordMeasuredAt
		) {
			setError(
				'Informe uma referência, um valor maior que zero e a data da medição.',
			);
			return;
		}
		setSavingPersonalRecord(true);
		const result = await personalRecordsService.create({
			athleteId: personalRecordAthlete.id,
			...(recordReferenceType === 'group'
				? { exerciseGroupId: Number(recordReferenceId) }
				: { exerciseId: Number(recordReferenceId) }),
			value: Number(recordValue),
			measuredAt: recordMeasuredAt,
		});
		if (!result.success)
			setError(result.error || 'Não foi possível registrar o RP.');
		else {
			setPersonalRecords((current) =>
				result.data ? [result.data, ...current] : current,
			);
			setRecordReferenceId('');
			setRecordValue('');
		}
		setSavingPersonalRecord(false);
	};

	const allVisibleSelected =
		visibleAthletes.length > 0 &&
		visibleAthletes.every((athlete) => selectedAthleteIds.includes(athlete.id));
	const recordMetricSymbol = useMemo(() => {
		if (!recordReferenceId) return '';
		if (recordReferenceType === 'group') {
			return (
				exerciseGroups.find((group) => group.id === Number(recordReferenceId))
					?.metric2?.symbol ?? ''
			);
		}
		const metric2Id = recordExercises.find(
			(exercise) => Number(exercise.id) === Number(recordReferenceId),
		)?.metric2Id;
		return recordMetrics.find((metric) => metric.id === metric2Id)?.symbol ?? '';
	}, [
		exerciseGroups,
		recordExercises,
		recordMetrics,
		recordReferenceId,
		recordReferenceType,
	]);
	const toggleAthlete = (id: string) => {
		setSelectedAthleteIds((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		);
	};
	const toggleVisibleAthletes = () => {
		setSelectedAthleteIds((current) =>
			allVisibleSelected
				? current.filter(
						(id) => !visibleAthletes.some((athlete) => athlete.id === id),
					)
				: [
						...new Set([...current, ...visibleAthletes.map((athlete) => athlete.id)]),
					],
		);
	};

	return (
		<div className="space-y-7 p-4">
			<div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
				<div>
					<p className="type-label-caps text-secondary-fixed-dim">
						Gestão de atletas
					</p>
					<h1 className="mt-2 text-3xl font-bold tracking-tight text-primary">
						Acompanhamento
					</h1>
					<p className="mt-2 text-on-surface-variant">
						Acompanhe os atletas e defina o treinador responsável por cada um.
					</p>
				</div>
			</div>

			<section className="grid gap-3 sm:grid-cols-3">
				<MetricCard
					label="Atletas"
					value={athletes.length}
					description="Atletas visíveis para o seu perfil."
				/>
				<MetricCard
					label="Com treinador"
					value={athletes.filter((a) => a.activeAssociation).length}
					description="Vínculos ativos no momento."
				/>
				<MetricCard
					label="Sem treinador"
					value={athletes.filter((a) => !a.activeAssociation).length}
					description="Precisam de uma associação."
				/>
			</section>

			{error && <ErrorBox message={error} />}
			<div className="flex max-w-xl items-center rounded-xl border border-outline-variant bg-surface-container-high px-3">
				<RiSearchLine className="text-on-surface-variant" size={20} />
				<input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Buscar atleta"
					className="w-full bg-transparent px-3 py-3 text-primary outline-none"
				/>
			</div>
			{canManage && selectedAthleteIds.length > 0 && (
				<div className="space-y-3">
					{associationPanelOpen && (
						<div className="flex flex-col gap-4 rounded-2xl border border-primary-fixed-dim/30 bg-surface-container p-4 md:flex-row md:items-end">
							<div className="flex-1">
								<p className="mb-2 text-sm font-semibold text-primary">
									Gerenciar treinador de {selectedAthleteIds.length} atleta
									{selectedAthleteIds.length === 1 ? '' : 's'}
								</p>
								<p className="text-xs text-on-surface-variant">
									O vínculo anterior ativo, se houver, será encerrado.
								</p>
							</div>
							<div className="min-w-56">
								<Select
									label="Treinador"
									placeholder="Selecione um treinador"
									value={trainerId}
									onChange={(event) => setTrainerId(event.target.value)}
									options={[
										{ value: NO_TRAINER_VALUE, label: 'Nenhum' },
										...trainers.map((trainer) => ({
											value: trainer.id,
											label: trainer.person.name,
										})),
									]}
								/>
							</div>
							<div>
								<label
									htmlFor="association-start-date"
									className="mb-1 block text-xs text-on-surface-variant"
								>
									Data de início
								</label>
								<input
									id="association-start-date"
									type="date"
									value={startDate}
									min={minimumStartDate}
									max={maximumStartDate}
									onChange={(event) => setStartDate(event.target.value)}
									className="rounded-xl border border-outline-variant bg-surface-container-high px-3 py-3 text-primary outline-none focus:border-primary-fixed-dim/50"
								/>
							</div>
							<Button
								onClick={() => void saveAssociation()}
								disabled={savingAssociation}
							>
								{savingAssociation ? 'Salvando...' : 'Confirmar associação'}
							</Button>
							<Button variant="ghost" onClick={() => setAssociationPanelOpen(false)}>
								Cancelar
							</Button>
						</div>
					)}
					{workoutPanelOpen && (
						<div className="flex flex-col gap-4 rounded-2xl border border-primary-fixed-dim/30 bg-surface-container p-4 md:flex-row md:items-end">
							<div className="flex-1">
								<p className="mb-2 text-sm font-semibold text-primary">
									Associar treino a {selectedAthleteIds.length} atleta
									{selectedAthleteIds.length === 1 ? '' : 's'}
								</p>
								<p className="text-xs text-on-surface-variant">
									Sem agendamento, os treinos serão criados como pendentes.
								</p>
							</div>
							<div className="min-w-56">
								<Select
									label="Template de treino"
									placeholder="Selecione uma template"
									value={workoutTemplateId}
									onChange={(event) => setWorkoutTemplateId(event.target.value)}
									options={workoutTemplates.map((template) => ({
										value: template.id,
										label: template.name,
									}))}
								/>
							</div>
							<div>
								<label
									htmlFor="workout-scheduled-date"
									className="mb-1 block text-xs text-on-surface-variant"
								>
									Data de agendamento (opcional)
								</label>
								<input
									id="workout-scheduled-date"
									type="date"
									value={workoutScheduledDate}
									onChange={(event) => setWorkoutScheduledDate(event.target.value)}
									className="rounded-xl border border-outline-variant bg-surface-container-high px-3 py-3 text-primary outline-none focus:border-primary-fixed-dim/50"
								/>
							</div>
							<Button
								onClick={() => void saveWorkoutAssignment()}
								disabled={savingWorkout}
							>
								{savingWorkout ? 'Associando...' : 'Associar treino'}
							</Button>
							<Button variant="ghost" onClick={() => setWorkoutPanelOpen(false)}>
								Cancelar
							</Button>
						</div>
					)}
					{!associationPanelOpen && !workoutPanelOpen && (
						<div className="flex flex-wrap gap-3">
							<Button onClick={() => void openAssociation()}>
								<RiAddLine size={20} /> Gerenciar treinador ({selectedAthleteIds.length}
								){selectedAthleteIds.length === 1 ? '' : 's'}
							</Button>
							<Button onClick={() => void openWorkoutAssignment()} variant="outline">
								<RiCalendarScheduleLine size={20} /> Associar treino (
								{selectedAthleteIds.length}){selectedAthleteIds.length === 1 ? '' : 's'}
							</Button>
						</div>
					)}
				</div>
			)}

			<div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
				<div
					className={`hidden gap-4 border-b border-outline-variant px-5 py-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant md:grid ${canManage ? 'grid-cols-[32px_minmax(220px,1.4fr)_minmax(180px,1fr)_150px_130px_140px]' : 'grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_150px_130px]'}`}
				>
					{canManage && (
						<input
							type="checkbox"
							checked={allVisibleSelected}
							onChange={toggleVisibleAthletes}
							aria-label="Selecionar todos os atletas exibidos"
							className="h-4 w-4 accent-primary-container"
						/>
					)}
					<span>Atleta</span>
					<span>Treinador responsável</span>
					<span>Início do vínculo</span>
					<span>Status</span>
					{canManage && <span>Ações</span>}
				</div>
				{loading ? (
					<p className="p-6 text-sm text-on-surface-variant">
						Carregando atletas...
					</p>
				) : visibleAthletes.length === 0 ? (
					<p className="p-6 text-sm text-on-surface-variant">
						Nenhum atleta encontrado.
					</p>
				) : (
					visibleAthletes.map((athlete) => (
						<div
							key={athlete.id}
							className={`grid gap-3 border-b border-outline-variant/70 px-5 py-4 last:border-b-0 md:items-center md:gap-4 ${canManage ? 'md:grid-cols-[32px_minmax(220px,1.4fr)_minmax(180px,1fr)_150px_130px_140px]' : 'md:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_150px_130px]'}`}
						>
							{canManage && (
								<input
									type="checkbox"
									checked={selectedAthleteIds.includes(athlete.id)}
									onChange={() => toggleAthlete(athlete.id)}
									aria-label={`Selecionar ${athlete.person.name}`}
									className="h-4 w-4 self-center accent-primary-container"
								/>
							)}
							<div className="flex items-center gap-3">
								<span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/15 text-primary-fixed-dim">
									<RiUserLine size={20} />
								</span>
								<div>
									<p className="font-semibold text-primary">{athlete.person.name}</p>
									<p className="text-xs text-on-surface-variant">
										{athlete.person.email ||
											athlete.person.phone ||
											'Contato não informado'}
									</p>
								</div>
							</div>
							<div>
								<span className="text-xs text-on-surface-variant md:hidden">
									Treinador:{' '}
								</span>
								<span className="text-sm text-primary">
									{athlete.activeAssociation?.trainer.person.name || 'Sem treinador'}
								</span>
							</div>
							<div className="text-sm text-on-surface-variant">
								{athlete.activeAssociation
									? formatDate(athlete.activeAssociation.startDate)
									: '—'}
							</div>
							<div>
								<Badge
									label={athlete.activeAssociation ? 'Associado' : 'Pendente'}
									type={athlete.activeAssociation ? 'primary' : 'secondary'}
								/>
							</div>
							{canManage && (
								<div>
									{canRegisterPersonalRecord && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => void openPersonalRecord(athlete)}
										>
											<RiMedalLine size={17} /> Registrar RP
										</Button>
									)}
								</div>
							)}
						</div>
					))
				)}
			</div>
			<PersonalRecordModal
				isOpen={!!personalRecordAthlete}
				title={`Registrar RP${personalRecordAthlete ? ` — ${personalRecordAthlete.person.name}` : ''}`}
				description="Registre um 1RM de referência por grupo de exercícios ou exercício individual."
				onClose={() => setPersonalRecordAthlete(null)}
			>
				<div className="space-y-5">
					<div className="grid gap-4 md:grid-cols-2">
						<Select
							label="Tipo de referência"
							value={recordReferenceType}
							onChange={(event) => {
								setRecordReferenceType(event.target.value as 'group' | 'exercise');
								setRecordReferenceId('');
							}}
							options={[
								{ value: 'group', label: 'Grupo de exercícios' },
								{ value: 'exercise', label: 'Exercício individual' },
							]}
						/>
						<Select
							label={
								recordReferenceType === 'group' ? 'Grupo de exercícios' : 'Exercício'
							}
							value={recordReferenceId}
							onChange={(event) => setRecordReferenceId(event.target.value)}
							placeholder="Selecione"
							options={
								recordReferenceType === 'group'
									? exerciseGroups.map((group) => ({
											value: String(group.id),
											label: group.name,
										}))
									: recordExercises.map((exercise) => ({
											value: String(exercise.id),
											label: exercise.name,
										}))
							}
						/>
						<Input
							label={`Valor do 1RM${recordMetricSymbol ? ` (${recordMetricSymbol})` : ''}`}
							type="number"
							min="0.001"
							step="0.001"
							value={recordValue}
							onChange={(event) => setRecordValue(event.target.value)}
							required
						/>
						<Input
							label="Data da medição"
							type="date"
							value={recordMeasuredAt}
							onChange={(event) => setRecordMeasuredAt(event.target.value)}
							required
						/>
					</div>
					<div className="rounded-xl border border-outline-variant bg-surface-container-high p-4">
						<p className="mb-3 text-sm font-semibold text-primary">
							Registros anteriores
						</p>
						{personalRecords.length === 0 ? (
							<p className="text-sm text-on-surface-variant">
								Nenhum RP registrado para este atleta.
							</p>
						) : (
							<div className="space-y-2">
								{personalRecords.slice(0, 5).map((record) => (
									<div key={record.id} className="flex justify-between gap-4 text-sm">
										<span className="text-primary">
											{record.exerciseGroup?.name || record.exercise?.name}
										</span>
										<span className="text-on-surface-variant">
											{record.value} · {formatDate(record.measuredAt)}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
					<div className="flex justify-end gap-3 border-t border-outline-variant pt-5">
						<Button variant="ghost" onClick={() => setPersonalRecordAthlete(null)}>
							Fechar
						</Button>
						<Button
							onClick={() => void savePersonalRecord()}
							disabled={savingPersonalRecord}
						>
							{savingPersonalRecord ? 'Registrando...' : 'Registrar RP'}
						</Button>
					</div>
				</div>
			</PersonalRecordModal>
		</div>
	);
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat('pt-BR', {
		timeZone: 'America/Sao_Paulo',
	}).format(new Date(value));
}
