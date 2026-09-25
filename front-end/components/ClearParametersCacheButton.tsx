'use client';

import { useState } from 'react';
import { RiDeleteBinLine } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { getSessionUser } from '@/lib/auth';
import { clearTrainerReviews, discardPendingWorkouts, readPendingWorkouts, synchronizeAll, syncPendingWorkouts, syncTrainerWorkoutList } from '@/lib/offline-contingency';
import { exercisesService, metricsService } from '@/gateway/services/parametro';
import { Role } from '@/lib/roles';

export default function ClearParametersCacheButton({
	presentation,
	compact = false,
}: {
	presentation: 'profile' | 'sidebar';
	compact?: boolean;
}) {
	const [clearing, setClearing] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const [pendingCount, setPendingCount] = useState(0);
	const [discardOpen, setDiscardOpen] = useState(false);

	async function openConfirmation() {
		setMessage(null);
		setFailed(false);
		if (!navigator.onLine) {
			setFailed(true);
			setMessage('É necessária conexão para prosseguir');
			return;
		}
		const user = getSessionUser();
		setPendingCount(user?.roles.includes(Role.TENANT_CLIENT) ? (await readPendingWorkouts(user.sub)).length : 0);
		setConfirmOpen(true);
	}

	async function handleClear(syncFirst: boolean) {
		if (!navigator.onLine) {
			setFailed(true);
			setMessage('É necessária conexão para prosseguir');
			return;
		}
		setClearing(true);
		setMessage(null);
		setFailed(false);
		try {
			const user = getSessionUser();
			const userId = user?.roles.includes(Role.TENANT_CLIENT) ? user.sub : null;
			await metricsService.sync();
			if (syncFirst && userId) {
				const result = await synchronizeAll(userId);
				const active = await syncPendingWorkouts(userId);
				if (active.errors.length || (await readPendingWorkouts(userId)).length)
					throw new Error([...result.errors, ...active.errors].join(' ') || 'Há alterações pendentes.');
			}
			if (userId && !syncFirst) await discardPendingWorkouts(userId);
			if (userId) {
				const result = await synchronizeAll(userId, true);
				if (result.errors.length) throw new Error(result.errors.join(' '));
				await clearTrainerReviews(userId);
			} else await Promise.all([metricsService.sync(), exercisesService.syncCatalog(true), user ? syncTrainerWorkoutList(user.sub) : Promise.resolve()]);
			setMessage('Dados locais atualizados pela carga completa.');
			setConfirmOpen(false);
			setDiscardOpen(false);
		} catch (cause) {
			setFailed(true);
			setMessage(cause instanceof Error ? cause.message : 'Não foi possível limpar os dados locais.');
		} finally {
			setClearing(false);
		}
	}

	const label = clearing ? 'Atualizando dados locais...' : 'Apagar dados locais e buscar novamente';
	const icon = <RiDeleteBinLine size={20} aria-hidden />;
	const feedback = message && (
		<p role={failed ? 'alert' : 'status'} className={compact ? 'sr-only' : `mt-2 text-sm ${failed ? 'text-error' : 'text-on-surface-variant'}`}>
			{message}
		</p>
	);
	const confirmation = <Modal
		isOpen={confirmOpen}
		title={discardOpen ? 'Descartar alterações locais?' : 'Apagar dados locais e buscar novamente?'}
		description={discardOpen ? 'As operações locais pendentes serão perdidas definitivamente.' : pendingCount ? `Há ${pendingCount} treino(s) com alterações pendentes. Deseja sincronizar antes de apagar?` : 'Os dados serão buscados novamente após a limpeza.'}
		eyebrow="Dados locais"
		size="sm"
		onClose={() => { if (!clearing) setConfirmOpen(false); }}
		closeOnBackdrop={!clearing}
		closeOnEscape={!clearing}
	>
		{failed && <p role="alert" className="mb-4 text-sm text-error">{message}</p>}
		<div className="flex justify-end gap-3">
			<Button type="button" variant="outline" disabled={clearing} onClick={() => { setConfirmOpen(false); setDiscardOpen(false); }}>Cancelar</Button>
			{pendingCount > 0 && !discardOpen && <Button type="button" variant="outline" disabled={clearing} onClick={() => setDiscardOpen(true)}>Não sincronizar</Button>}
			<Button type="button" disabled={clearing} onClick={() => void handleClear(!discardOpen)}>{clearing ? 'Aguarde...' : discardOpen ? 'Descartar e buscar' : pendingCount ? 'Sincronizar e buscar' : 'Apagar e buscar'}</Button>
		</div>
	</Modal>;

	if (presentation === 'profile') {
		return <>
			<Button type="button" variant="outline" className="w-full" disabled={clearing} onClick={openConfirmation}>
				{icon}{label}
			</Button>
			{feedback}
			{confirmation}
		</>;
	}

	return <>
		<button
			type="button"
			onClick={openConfirmation}
			disabled={clearing}
			title={compact ? label : undefined}
			aria-label={compact ? label : undefined}
			className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xl font-medium transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${compact ? 'justify-center' : ''}`}
		>
			<span className="shrink-0 text-primary">{icon}</span>
			{!compact && label}
		</button>
		{feedback}
		{confirmation}
	</>;
}
