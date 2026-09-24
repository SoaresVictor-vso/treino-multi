'use client';
import { useEffect, useState } from 'react';
import {
	associationsService,
	type TenantHistory,
} from '@/gateway/services/associations';
import Modal from '@/components/ui/Modal';
import PasswordConfirmationModal from '@/components/auth/PasswordConfirmationModal';

const notice =
	'Ao encerrar o vínculo, esta consultoria deixará de ver seus treinos e suas métricas pessoais. Os indicadores agregados históricos da consultoria continuarão considerando seu período de atendimento.';
export default function TenantAssociationsPage() {
	const [email, setEmail] = useState('');
	const [passwordAction, setPasswordAction] = useState<
		| { type: 'invite'; email: string }
		| { type: 'end'; id: string; athleteName: string }
		| null
	>(null);
	const [revokeInviteId, setRevokeInviteId] = useState<string | null>(null);
	const [active, setActive] = useState<
		{ id: string; athleteName: string; startedAt: string }[]
	>([]);
	const [history, setHistory] = useState<TenantHistory[]>([]);
	const [message, setMessage] = useState('');
	const [busy, setBusy] = useState(false);
	const load = async () => {
		const [a, h] = await Promise.all([
			associationsService.tenantActive(),
			associationsService.tenantHistory(),
		]);
		if (a.success && a.data) setActive(a.data);
		if (h.success && h.data) setHistory(h.data);
		if (!a.success || !h.success)
			setMessage(a.error || h.error || 'Não foi possível carregar os vínculos.');
	};
	useEffect(() => {
		void load();
	}, []);
	const invite = (event: React.FormEvent) => {
		event.preventDefault();
		setMessage('');
		setPasswordAction({ type: 'invite', email: email.trim().toLowerCase() });
	};
	const closePasswordModal = () => {
		if (busy) return;
		setPasswordAction(null);
	};
	const confirmPasswordAction = async (password: string) => {
		if (!passwordAction || busy) return;
		setBusy(true);
		setMessage('');
		const result =
			passwordAction.type === 'invite'
				? await associationsService.invite(passwordAction.email, password)
				: await associationsService.endTenant(passwordAction.id, password);
		setBusy(false);
		setPasswordAction(null);
		if (result.success && passwordAction.type === 'invite') setEmail('');
		setMessage(
			passwordAction.type === 'invite'
				? result.success
					? 'Convite enviado. O atleta precisa aceitá-lo para liberar acesso.'
					: result.error || 'Convite não enviado.'
				: result.success
					? 'Vínculo encerrado.'
					: result.error || 'Vínculo não encerrado.',
		);
		if (result.success) await load();
	};
	const revoke = async (id: string) => {
		setRevokeInviteId(null);
		setBusy(true);
		setMessage('');
		const result = await associationsService.revoke(id);
		setBusy(false);
		setMessage(
			result.success
				? 'Convite revogado.'
				: result.error || 'Não foi possível revogar o convite.',
		);
		await load();
	};
	const closeRevokeModal = () => {
		if (busy) return;
		setRevokeInviteId(null);
	};
	return (
		<section className="mx-auto max-w-4xl space-y-7">
			<h1 className="text-2xl font-bold">Vínculos com atletas</h1>
			{message && (
				<p role="status" className="rounded-lg bg-surface-container p-3">
					{message}
				</p>
			)}
			<form
				onSubmit={invite}
				className="space-y-4 rounded-2xl bg-surface-container p-5"
			>
				<h2 className="font-semibold">Convidar atleta existente</h2>
				<p className="text-sm">
					O convite não libera acesso até o aceite do atleta e expira em sete dias.
				</p>
				<label className="block text-sm">
					E-mail do atleta
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="mt-1 w-full rounded-lg bg-surface-container-high p-3"
					/>
				</label>
				<button
					disabled={busy}
					className="rounded-lg bg-primary-container px-5 py-3 font-bold text-on-primary-fixed"
				>
					Enviar convite
				</button>
			</form>
			{passwordAction && (
				<PasswordConfirmationModal
					title={
						passwordAction.type === 'end' ? 'Encerrar vínculo' : 'Confirmar convite'
					}
					description={
						passwordAction.type === 'end'
							? `Encerrar vínculo com ${passwordAction.athleteName}? ${notice}`
							: `Confirme sua senha atual para convidar ${passwordAction.email}.`
					}
					confirmLabel={
						passwordAction.type === 'end' ? 'Encerrar vínculo' : 'Confirmar convite'
					}
					pendingLabel={
						passwordAction.type === 'end' ? 'Encerrando...' : 'Enviando...'
					}
					danger={passwordAction.type === 'end'}
					busy={busy}
					onClose={closePasswordModal}
					onConfirm={confirmPasswordAction}
				/>
			)}
			<section className="space-y-3">
				<h2 className="text-xl font-semibold">Vínculos ativos</h2>
				{!active.length && <p>Nenhum vínculo ativo.</p>}
				{active.map((item) => (
					<article
						key={item.id}
						className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container p-4"
					>
						<div>
							<strong>{item.athleteName}</strong>
							<p className="text-sm">
								Início: {new Date(item.startedAt).toLocaleDateString('pt-BR')}
							</p>
						</div>
						<button
							disabled={busy}
							onClick={() =>
								setPasswordAction({
									type: 'end',
									id: item.id,
									athleteName: item.athleteName,
								})
							}
							className="rounded-lg border border-error px-4 py-2 text-error"
						>
							Encerrar vínculo
						</button>
					</article>
				))}
			</section>
			<section className="space-y-3">
				<h2 className="text-xl font-semibold">Histórico</h2>
				{!history.length && <p>Nenhum evento registrado.</p>}
				{history.map((item, index) => (
					<article
						key={`${item.invitedAt}-${index}`}
						className="rounded-xl bg-surface-container p-4"
					>
						<div className="flex justify-between gap-3">
							<strong>{item.athleteName}</strong>
							<span className="capitalize">{item.status}</span>
						</div>
						{item.invitedEmail && (
							<p className="text-sm">E-mail convidado: {item.invitedEmail}</p>
						)}
						<p className="text-sm">
							Convite: {new Date(item.invitedAt).toLocaleDateString('pt-BR')}
						</p>
						<ol className="mt-2 space-y-1 text-sm">
							{item.events.map((event, i) => (
								<li key={i}>
									{new Date(event.at).toLocaleString('pt-BR')} · {event.type} ·{' '}
									{event.actorRole}
								</li>
							))}
						</ol>
						{item.status === 'pending' && item.id && (
							<button
								type="button"
								disabled={busy}
								onClick={() => setRevokeInviteId(item.id!)}
								className="mt-4 rounded-lg border border-error px-4 py-2 text-sm text-error"
							>
								Revogar convite
							</button>
						)}
					</article>
				))}
			</section>
			<Modal
				isOpen={revokeInviteId !== null}
				title="Revogar convite?"
				description="O atleta não poderá mais aceitar este convite. Esta ação não pode ser desfeita."
				eyebrow="Gerenciar vínculos"
				size="sm"
				onClose={closeRevokeModal}
				closeOnBackdrop={!busy}
				closeOnEscape={!busy}
			>
				<div className="flex justify-end gap-2">
					<button
						type="button"
						disabled={busy}
						onClick={closeRevokeModal}
						className="rounded-lg border px-4 py-2"
					>
						Manter convite
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={() => revokeInviteId && void revoke(revokeInviteId)}
						className="rounded-lg bg-error px-4 py-2 font-bold text-on-error"
					>
						{busy ? 'Revogando...' : 'Revogar convite'}
					</button>
				</div>
			</Modal>
		</section>
	);
}
