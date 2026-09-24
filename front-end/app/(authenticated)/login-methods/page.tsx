'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
	RiArrowLeftLine,
	RiLockPasswordLine,
	RiShieldCheckLine,
} from 'react-icons/ri';
import { authenticatedRequest, forgetBrowserSession } from '@/gateway/client';
import ChangePasswordForm from '@/components/auth/ChangePasswordForm';
import GoogleCredentialButton from '@/components/auth/GoogleCredentialButton';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import ErrorBox from '@/components/ui/ErrorBox';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordConfirmationModal from '@/components/auth/PasswordConfirmationModal';
import Modal from '@/components/ui/Modal';

type Methods = { passwordAvailable: boolean; providers: string[] };
const providerNames: Record<string, string> = { google: 'Google' };

export default function LoginMethodsPage() {
	const router = useRouter();
	const [methods, setMethods] = useState<Methods | null>(null);
	const [loading, setLoading] = useState(true);
	const [pendingProvider, setPendingProvider] = useState<string | null>(null);
	const [passwordModalOpen, setPasswordModalOpen] = useState(false);
	const [newPassword, setNewPassword] = useState('');
	const [confirmation, setConfirmation] = useState('');
	const [revoke, setRevoke] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function load() {
		const result = await authenticatedRequest<Methods>('auth/methods');
		if (result.success && result.data) setMethods(result.data);
		else setError(result.error || 'Não foi possível carregar os métodos.');
		setLoading(false);
	}
	useEffect(() => {
		let active = true;
		void authenticatedRequest<Methods>('auth/methods').then((result) => {
			if (!active) return;
			if (result.success && result.data) setMethods(result.data);
			else setError(result.error || 'Não foi possível carregar os métodos.');
			setLoading(false);
		});
		return () => {
			active = false;
		};
	}, []);

	async function onGoogleCredential(credential: string, action: 'link' | 'unlink' | 'set') {
		if (!methods || busy) return;
		if (action === 'set') {
			if (newPassword.length < 8)
				return setError('A senha deve ter pelo menos 8 caracteres.');
			if (newPassword !== confirmation) return setError('As senhas não conferem.');
		}
		if (
			action === 'unlink' &&
			!(methods.passwordAvailable || methods.providers.length > 1)
		)
			return;
		setBusy(true);
		setError(null);
		setMessage(null);
		const endpoint =
			action === 'set' ? 'auth/password/first' : `auth/oauth/${action}`;
		const result = await authenticatedRequest(endpoint, {
			method: 'POST',
			body: JSON.stringify({
				provider: 'google',
				credential,
				...(action === 'set' ? { newPassword, revokeAllSessions: revoke } : {}),
			}),
		});
		setBusy(false);
		if (!result.success) {
			setError(result.error || 'Ação não concluída.');
			return;
		}
		if (action === 'set' && revoke) {
			await forgetBrowserSession();
			router.replace('/login');
			return;
		}
		setNewPassword('');
		setConfirmation('');
		setPendingProvider(null);
		setPasswordModalOpen(false);
		setRevoke(false);
		setMessage(
			action === 'link'
				? 'Google vinculado.'
				: action === 'unlink'
					? 'Google removido.'
					: 'Senha definida.',
		);
		await load();
	}

	function closePasswordModal() {
		if (busy) return;
		setPasswordModalOpen(false);
		setNewPassword('');
		setConfirmation('');
		setRevoke(false);
		setError(null);
	}

	function closeRemoveModal() {
		if (busy) return;
		setPendingProvider(null);
		setError(null);
	}

	async function removeWithPassword(password: string) {
		if (
			!methods?.passwordAvailable ||
			!pendingProvider ||
			!password ||
			busy
		)
			return;
		if (!(methods.passwordAvailable || methods.providers.length > 1)) return;
		setBusy(true);
		setError(null);
		setMessage(null);
		const result = await authenticatedRequest('auth/oauth/unlink', {
			method: 'POST',
			body: JSON.stringify({
				provider: pendingProvider,
				password,
			}),
		});
		setBusy(false);
		if (!result.success) {
			setError(result.error || 'Não foi possível remover o provider.');
			return;
		}
		setPendingProvider(null);
		setMessage('Provider removido.');
		await load();
	}

	const googleLinked = methods?.providers.includes('google') ?? false;
	return (
		<section className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-8">
			<Link
				href="/app/perfil"
				className="inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-primary"
			>
				<RiArrowLeftLine aria-hidden />
				Voltar ao perfil
			</Link>
			<div>
				<p className="text-xs font-bold uppercase tracking-widest text-primary-fixed">
					Segurança da conta
				</p>
				<h1 className="mt-2 text-2xl font-bold text-primary">Métodos de login</h1>
				<p className="mt-2 text-sm text-on-surface-variant">
					Gerencie as formas de acessar sua conta.
				</p>
			</div>
			{loading ? (
				<p className="rounded-2xl bg-surface-container p-5 text-sm text-on-surface-variant">
					Carregando métodos...
				</p>
			) : methods ? (
				<>
					<section className="rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-6">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div className="flex items-start gap-3">
								<span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-container text-primary-fixed"><RiLockPasswordLine size={20} aria-hidden /></span>
								<div><h2 className="font-semibold text-primary">Senha</h2><p className="text-sm text-on-surface-variant">{methods.passwordAvailable ? 'Disponível para acessar sua conta.' : 'Defina uma senha para ter outra forma de acesso.'}</p></div>
							</div>
							<Button variant="outline" size="sm" onClick={() => { setPasswordModalOpen(true); setError(null); }}>{methods.passwordAvailable ? 'Alterar senha' : 'Registrar senha'}</Button>
						</div>
					</section>
					{[
						'google',
						...methods.providers.filter((provider) => provider !== 'google'),
					].map((provider) => {
						const linked = methods.providers.includes(provider);
						const canRemove =
							methods.passwordAvailable || methods.providers.length > 1;
						return (
							<section
								key={provider}
								className="rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-6"
							>
								<div className="flex flex-wrap items-start justify-between gap-4">
									<div>
										<h2 className="font-semibold text-primary">
											{providerNames[provider] ?? provider}
										</h2>
										<p className="mt-1 text-sm text-on-surface-variant">
											{linked ? 'Vinculado à sua conta.' : 'Ainda não vinculado.'}
										</p>
									</div>
									{linked && (
										<Button
											variant="danger"
											size="sm"
											disabled={busy || !canRemove || provider !== 'google'}
											title={
												!canRemove
													? 'Defina uma senha ou vincule outro provider antes de remover.'
													: undefined
											}
											onClick={() => {
												setPendingProvider(provider);
												setError(null);
											}}
										>
											Remover
										</Button>
									)}
								</div>

								{provider === 'google' &&
									(!linked ||
										(pendingProvider === 'google' && !methods.passwordAvailable)) && (
										<div className="mt-5 border-t border-outline-variant pt-5">
											<p className="mb-3 text-sm text-on-surface-variant">
												{linked
													? 'Confirme sua identidade para remover o Google.'
													: 'Confirme sua identidade para vincular o Google.'}
											</p>
											<div className={busy ? 'pointer-events-none opacity-50' : ''}>
												<GoogleCredentialButton onCredential={(credential) => onGoogleCredential(credential, linked ? 'unlink' : 'link')} />
											</div>
											{pendingProvider === 'google' && (
												<Button
													variant="ghost"
													size="sm"
													className="mt-3"
													onClick={() => setPendingProvider(null)}
												>
													Cancelar
												</Button>
											)}
										</div>
									)}
							</section>
						);
					})}
				</>
			) : null}
			<Modal
				isOpen={passwordModalOpen}
				title={methods?.passwordAvailable ? 'Alterar senha' : 'Registrar senha'}
				description={methods?.passwordAvailable ? 'Confirme sua senha atual antes de definir uma nova.' : 'Confirme sua identidade com Google para criar uma senha.'}
				eyebrow="Segurança da conta"
				size="sm"
				onClose={closePasswordModal}
				closeOnBackdrop={!busy}
				closeOnEscape={!busy}
			>
				{methods?.passwordAvailable ? (
					<ChangePasswordForm onSuccess={() => { setPasswordModalOpen(false); setMessage('Senha alterada com sucesso.'); }} onCancel={closePasswordModal} onBusyChange={setBusy} />
				) : (
					<div className="space-y-5">
						<div className="grid gap-4 sm:grid-cols-2">
							<PasswordInput label="Nova senha" minLength={8} autoComplete="new-password" value={newPassword} disabled={busy} onChange={(event) => setNewPassword(event.target.value)} />
							<PasswordInput label="Confirmar nova senha" minLength={8} autoComplete="new-password" value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} />
						</div>
						<p className="flex items-center gap-2 text-xs text-on-surface-variant"><RiShieldCheckLine size={16} aria-hidden />A nova senha deve ter pelo menos 8 caracteres.</p>
						<Checkbox label="Revogar todas as sessões" checked={revoke} disabled={busy} onChange={(event) => setRevoke(event.target.checked)} />
						{error && <ErrorBox message={error} />}
						<div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-5">
							<div className={busy ? 'pointer-events-none opacity-50' : ''}>{googleLinked && <GoogleCredentialButton onCredential={(credential) => onGoogleCredential(credential, 'set')} />}</div>
							<Button variant="ghost" onClick={closePasswordModal} disabled={busy}>Cancelar</Button>
						</div>
					</div>
				)}
			</Modal>
			{pendingProvider && methods?.passwordAvailable && <PasswordConfirmationModal
				title={`Remover ${providerNames[pendingProvider ?? ''] ?? pendingProvider ?? 'método'}`}
				description="Confirme sua senha atual para remover esta forma de login."
				confirmLabel="Confirmar remoção"
				pendingLabel="Removendo..."
				danger
				busy={busy}
				onClose={closeRemoveModal}
				onConfirm={removeWithPassword}
			>
				{error && <ErrorBox message={error} />}
			</PasswordConfirmationModal>}
			{error && !passwordModalOpen && (!pendingProvider || !methods?.passwordAvailable) && (
				<ErrorBox message={error} />
			)}
			{message && (
				<p role="status" className="text-sm font-medium text-primary-fixed">
					{message}
				</p>
			)}
		</section>
	);
}
