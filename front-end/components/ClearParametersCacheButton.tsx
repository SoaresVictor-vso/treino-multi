'use client';

import { useState } from 'react';
import { RiDeleteBinLine } from 'react-icons/ri';
import { clearParametersCache } from '@/gateway/services/parametro';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

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

	function openConfirmation() {
		setMessage(null);
		setFailed(false);
		setConfirmOpen(true);
	}

	async function handleClear() {
		setClearing(true);
		setMessage(null);
		setFailed(false);
		try {
			await clearParametersCache();
			setMessage('Cache de exercícios e métricas limpo.');
			setConfirmOpen(false);
		} catch {
			setFailed(true);
			setMessage('Não foi possível limpar o cache. Tente novamente.');
		} finally {
			setClearing(false);
		}
	}

	const label = clearing ? 'Limpando cache...' : 'Limpar cache';
	const icon = <RiDeleteBinLine size={20} aria-hidden />;
	const feedback = message && !failed && (
		<p role="status" className={compact ? 'sr-only' : 'mt-2 text-sm text-on-surface-variant'}>
			{message}
		</p>
	);
	const confirmation = <Modal
		isOpen={confirmOpen}
		title="Limpar cache?"
		description="Os exercícios e as métricas armazenados neste dispositivo serão removidos e carregados novamente quando necessários."
		eyebrow="Cache local"
		size="sm"
		onClose={() => { if (!clearing) setConfirmOpen(false); }}
		closeOnBackdrop={!clearing}
		closeOnEscape={!clearing}
	>
		{failed && <p role="alert" className="mb-4 text-sm text-error">{message}</p>}
		<div className="flex justify-end gap-3">
			<Button type="button" variant="outline" disabled={clearing} onClick={() => setConfirmOpen(false)}>Cancelar</Button>
			<Button type="button" disabled={clearing} onClick={handleClear}>{clearing ? 'Limpando...' : 'Confirmar limpeza'}</Button>
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
