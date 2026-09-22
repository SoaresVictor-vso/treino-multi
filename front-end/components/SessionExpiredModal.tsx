'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { SESSION_EXPIRED_EVENT } from '@/gateway/client';

export default function SessionExpiredModal() {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const openModal = () => setIsOpen(true);
		window.addEventListener(SESSION_EXPIRED_EVENT, openModal);
		return () => window.removeEventListener(SESSION_EXPIRED_EVENT, openModal);
	}, []);

	const redirectToLogin = () => {
		setIsOpen(false);
		window.location.assign('/login');
	};

	return (
		<Modal
			isOpen={isOpen}
			title="Sessão expirada"
			description="Sua sessão não pôde ser renovada. Entre novamente para continuar."
			onClose={redirectToLogin}
		>
			<div className="flex justify-end">
				<Button onClick={redirectToLogin}>Ir para o login</Button>
			</div>
		</Modal>
	);
}
