'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { API_ERROR_EVENT } from '@/gateway/client';

export default function ApiErrorModal() {
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		const showError = (event: Event) => {
			const { detail } = event as CustomEvent<{ message?: string }>;
			setMessage(detail?.message || 'Não foi possível realizar a operação.');
		};
		window.addEventListener(API_ERROR_EVENT, showError);
		return () => window.removeEventListener(API_ERROR_EVENT, showError);
	}, []);

	return (
		<Modal
			isOpen={!!message}
			title="Não foi possível concluir a operação"
			description={message ?? undefined}
			onClose={() => setMessage(null)}
		>
			<div className="flex justify-end">
				<Button onClick={() => setMessage(null)}>Entendi</Button>
			</div>
		</Modal>
	);
}
