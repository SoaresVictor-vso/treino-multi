'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Modal from '@/components/ui/Modal';
import PasswordInput from '@/components/auth/PasswordInput';

type PasswordConfirmationModalProps = {
	title: string;
	description: string;
	confirmLabel: string;
	pendingLabel: string;
	onConfirm: (password: string) => Promise<void>;
	onClose: () => void;
	busy?: boolean;
	danger?: boolean;
	children?: ReactNode;
};

export default function PasswordConfirmationModal({
	title, description, confirmLabel, pendingLabel, onConfirm, onClose,
	busy = false, danger = false, children,
}: PasswordConfirmationModalProps) {
	const [password, setPassword] = useState('');

	const close = () => {
		if (busy) return;
		setPassword('');
		onClose();
	};

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!password || busy) return;
		await onConfirm(password);
		setPassword('');
	};

	return (
		<Modal isOpen title={title} description={description} eyebrow="Segurança da conta"
			size="sm" onClose={close} closeOnBackdrop={!busy} closeOnEscape={!busy}>
			<form onSubmit={submit} className="space-y-5">
				<PasswordInput label="Senha atual" required autoComplete="current-password"
					value={password} disabled={busy}
					onChange={(event) => setPassword(event.target.value)} />
				{children}
				<div className="flex justify-end gap-2 border-t border-outline-variant pt-5">
					<button type="button" disabled={busy} onClick={close} className="rounded-lg border px-4 py-2">Cancelar</button>
					<button type="submit" disabled={busy || !password}
						className={danger ? 'rounded-lg bg-error px-4 py-2 font-bold text-on-error' : 'rounded-lg bg-primary-container px-4 py-2 font-bold text-on-primary-fixed'}>
						{busy ? pendingLabel : confirmLabel}
					</button>
				</div>
			</form>
		</Modal>
	);
}
