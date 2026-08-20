'use client';

import { FormEvent, useEffect, useState } from 'react';
import { RiCheckLine, RiSaveLine } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import ErrorBox from '@/components/ui/ErrorBox';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import {
	exercisesService,
	type CreateExerciseInput,
	type ExerciseParameter,
} from '@/gateway/services/parametro/exercises';
import { metricsService, type Metric } from '@/gateway/services/parametro/metrics';
import { TTL_PARAMETROS } from '@/lib/constants';

const initialForm: CreateExerciseInput = {
	name: '',
	description: '',
	metric1Id: 0,
	metric2Id: undefined,
	visualUrl: '',
};

const MEASUREMENT_OPTIONS = [
	{ value: 'reps-time', label: 'Repetições por tempo', symbols: ['reps', 's'] },
	{ value: 'reps-weight', label: 'Repetições por peso', symbols: ['reps', 'kg'] },
	{ value: 'time', label: 'Tempo', symbols: ['s'] },
	{ value: 'distance-time', label: 'Distância por tempo', symbols: ['m', 's'] },
	{ value: 'distance-pace', label: 'Distância por ritmo', symbols: ['m', 'min/km'] },
	{ value: 'distance', label: 'Distância', symbols: ['m'] },
	{ value: 'reps', label: 'Repetições', symbols: ['reps'] },
	{ value: 'reps-distance', label: 'Repetições por distância', symbols: ['reps', 'm'] },
	{ value: 'weight-time', label: 'Peso por tempo', symbols: ['kg', 's'] },
] as const;

function formatCacheDuration(milliseconds: number): string {
	const minutes = Math.round(milliseconds / (60 * 1000));
	if (minutes % 60 === 0) {
		const hours = minutes / 60;
		return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
	}
	return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

export default function ExerciseForm({
	isGlobal,
	canCreateExercise,
	onCreated,
}: {
	isGlobal: boolean;
	canCreateExercise: boolean;
	onCreated?: (exercise: ExerciseParameter) => void;
}) {
	const [form, setForm] = useState(initialForm);
	const [measurement, setMeasurement] = useState('');
	const [metrics, setMetrics] = useState<Metric[]>([]);
	const [loadingMetrics, setLoadingMetrics] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	useEffect(() => {
		metricsService.search().then((items) => {
			setMetrics(items);
			setLoadingMetrics(false);
		});
	}, []);

	const update = <K extends keyof CreateExerciseInput>(
		key: K,
		value: CreateExerciseInput[K],
	) => setForm((current) => ({ ...current, [key]: value }));

	const measurementOptions = MEASUREMENT_OPTIONS.map((option) => {
		const metricIds = option.symbols.map(
			(symbol) => metrics.find((metric) => metric.symbol === symbol)?.id,
		);
		return {
			...option,
			metricIds,
			disabled: metricIds.some((id) => id === undefined),
		};
	});

	const selectMeasurement = (value: string) => {
		const option = measurementOptions.find((item) => item.value === value);
		if (!option || option.disabled) return;
		setMeasurement(value);
		setForm((current) => ({
			...current,
			metric1Id: option.metricIds[0] ?? 0,
			metric2Id: option.metricIds[1] ?? undefined,
		}));
	};

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSuccess(false);
		setSaving(true);
		const response = await exercisesService.create({
			...form,
			name: form.name.trim(),
			description: form.description?.trim(),
			visualUrl: form.visualUrl?.trim() || undefined,
			metric2Id: form.metric2Id || undefined,
		});
		setSaving(false);
		if (!response.success || !response.data) {
			setError(response.error || 'Não foi possível cadastrar o exercício.');
			return;
		}
		setForm(initialForm);
		setMeasurement('');
		setSuccess(true);
		onCreated?.(response.data);
	}

	if (!canCreateExercise) return null;

	return (
		<div className="mx-auto max-w-3xl space-y-8">
			<header>
				<p className="type-label-caps text-primary-fixed-dim">Catálogo</p>
				<h1 className="type-headline-lg mt-2">Cadastrar exercício</h1>
				<p className="mt-2 text-on-surface-variant">
					Adicione um exercício e defina as métricas usadas durante o treino.
				</p>
			</header>

			{error && <ErrorBox message={error} />}
			{success && (
				<div className="flex items-center gap-2 rounded border border-primary/40 bg-primary/10 p-3 text-primary">
					<RiCheckLine /> Exercício cadastrado com sucesso.
				</div>
			)}
			<div className="rounded border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
				A atualização do catálogo é feita conforme o tempo de cache parametrizado de{' '}
				<strong className="text-primary">{formatCacheDuration(TTL_PARAMETROS)}</strong>.
				Por isso, pode levar até esse período até que o novo exercício fique disponível
				para todos os usuários.
			</div>

			<form
				onSubmit={submit}
				className="space-y-6 rounded border border-outline-variant bg-surface-container p-5 sm:p-8"
			>
				<div className="grid gap-5 sm:grid-cols-2">
					<Input
						label="Nome"
						value={form.name}
						maxLength={50}
						required
						placeholder="Ex.: Agachamento livre"
						onChange={(event) => update('name', event.target.value)}
					/>
					<Select
						label="Tipo de medição"
						required
						disabled={loadingMetrics}
						value={measurement}
						placeholder="Selecione o tipo"
						options={measurementOptions.map(({ value, label, disabled }) => ({
							value,
							label,
							disabled,
						}))}
						onChange={(event) => selectMeasurement(event.target.value)}
					/>
				</div>
				<Input
					label="URL visual (opcional)"
					type="url"
					maxLength={100}
					value={form.visualUrl}
					placeholder="https://..."
					onChange={(event) => update('visualUrl', event.target.value)}
				/>
				<Textarea
					label="Descrição"
					rows={4}
					maxLength={255}
					value={form.description}
					placeholder="Explique como o exercício deve ser executado"
					onChange={(event) => update('description', event.target.value)}
				/>
				<div className="flex flex-col gap-4 border-t border-outline-variant pt-5 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm text-on-surface-variant">
						{isGlobal
							? 'Este exercício será global e ficará visível para todos os tenants.'
							: 'Este exercício ficará disponível apenas para o seu tenant.'}
					</p>
					<Button type="submit" disabled={saving || loadingMetrics || !form.metric1Id}>
						<RiSaveLine /> {saving ? 'Salvando...' : 'Cadastrar exercício'}
					</Button>
				</div>
			</form>
		</div>
	);
}
