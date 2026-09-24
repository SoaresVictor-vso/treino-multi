'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
	RiEditLine,
	RiLogoutBoxRLine,
	RiMailLine,
	RiPhoneLine,
	RiSaveLine,
	RiUserLine,
} from 'react-icons/ri';
import Button from '@/components/ui/Button';
import ErrorBox from '@/components/ui/ErrorBox';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import {
	applyMask,
	CPF_MASK_REGEX,
	CPF_REGEX,
	PHONE_MASK_REGEX,
	PHONE_REGEX,
} from '@/lib/constants';
import { UsersService } from '@/gateway/services/users';
import { logoutSession } from '@/gateway/client';

const usersService = new UsersService();
type ProfileForm = { name: string; email: string; phone: string; document: string };
const emptyProfile: ProfileForm = { name: '', email: '', phone: '', document: '' };

export default function PerfilPage() {
	const router = useRouter();
	const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
	const [loading, setLoading] = useState(true);
	const [profileOpen, setProfileOpen] = useState(false);
	const [documentLocked, setDocumentLocked] = useState(false);
	const [profileError, setProfileError] = useState<string | null>(null);
	const [profileMessage, setProfileMessage] = useState<string | null>(null);
	const [savingProfile, setSavingProfile] = useState(false);

	useEffect(() => {
		let active = true;
		void usersService.getMe().then((result) => {
			if (!active) return;
			if (!result.success || !result.data) setProfileError(result.error || 'Não foi possível carregar seu perfil.');
			else {
				setProfile({ name: result.data.name, email: result.data.email || '', phone: result.data.phone || '', document: result.data.document || '' });
				setDocumentLocked(!!result.data.document);
			}
			setLoading(false);
		});
		return () => { active = false; };
	}, []);

	function openProfileModal() {
		setProfileError(null);
		setProfileMessage(null);
		setProfileOpen(true);
	}

	async function handleLogout() {
		await logoutSession();
		router.replace('/login');
	}

	async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const name = profile.name.trim();
		const email = profile.email.trim();
		const phone = profile.phone.trim();
		const document = profile.document.trim();
		if (name.length < 2) return setProfileError('Informe um nome com pelo menos 2 caracteres.');
		if (!/^\S+@\S+\.\S+$/.test(email)) return setProfileError('Informe um e-mail válido.');
		if (phone && !PHONE_REGEX.test(phone)) return setProfileError('Informe um telefone válido.');
		if (!documentLocked && document && !CPF_REGEX.test(document)) return setProfileError('Informe um CPF válido.');

		setSavingProfile(true);
		const result = await usersService.updateMe({ name, phone: phone || null, document: documentLocked ? undefined : document || null });
		setSavingProfile(false);
		if (!result.success || !result.data) return setProfileError(result.error || 'Não foi possível salvar seus dados.');
		setProfile({ name: result.data.name, email: result.data.email || '', phone: result.data.phone || '', document: result.data.document || '' });
		setDocumentLocked(!!result.data.document);
		setProfileOpen(false);
		setProfileMessage('Dados pessoais atualizados.');
	}

	return <section className="mx-auto w-full max-w-2xl px-4 pb-4">
		{loading ? <p className="rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">Carregando seus dados...</p> : <section className="overflow-hidden rounded-2xl bg-surface-container p-4">
			<section>
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-center gap-3">
						<span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-secondary-container text-primary-fixed" aria-label="Espaço reservado para foto de perfil"><RiUserLine size={28} aria-hidden /></span>
						<div className="min-w-0"><p className="truncate text-base font-semibold text-primary">{profile.name || 'Seu perfil'}</p><p className="mt-1 truncate text-sm text-on-surface-variant">{profile.email || 'E-mail não informado'}</p></div>
					</div>
					<button type="button" onClick={openProfileModal} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-2 text-sm font-medium text-primary-fixed transition hover:bg-primary-container/10 focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim/30" aria-label="Editar perfil"><RiEditLine size={18} aria-hidden /><span className="hidden sm:inline">Editar perfil</span></button>
				</div>
			</section>

			<section className="mt-6 border-t border-outline-variant/50 pt-5"><h2 className="mb-3 text-sm font-medium text-on-surface-variant">Dados pessoais</h2><div><div className="border-b border-outline-variant/50 py-3"><p className="text-xs font-medium text-on-surface-variant">Nome completo</p><p className="mt-1 text-sm font-medium text-primary">{profile.name || 'Não informado'}</p></div><div className="border-b border-outline-variant/50 py-3"><p className="text-xs font-medium text-on-surface-variant">E-mail</p><p className="mt-1 break-words text-sm font-medium text-primary">{profile.email || 'Não informado'}</p></div><div className="border-b border-outline-variant/50 py-3"><p className="text-xs font-medium text-on-surface-variant">Telefone</p><p className="mt-1 text-sm font-medium text-primary">{profile.phone ? applyMask(profile.phone, PHONE_MASK_REGEX) : 'Não informado'}</p></div><div className="py-3"><p className="text-xs font-medium text-on-surface-variant">CPF</p><p className="mt-1 text-sm font-medium text-primary">{profile.document ? applyMask(profile.document, CPF_MASK_REGEX) : 'Não informado'}</p></div></div>{profileMessage && <p role="status" className="mt-3 text-sm font-medium text-primary-fixed">{profileMessage}</p>}{profileError && <div className="mt-3"><ErrorBox message={profileError} /></div>}</section>

			<section className="mt-6 border-t border-outline-variant/50 pt-5"><h2 className="mb-3 text-sm font-medium text-on-surface-variant">Sua conta</h2><Link href="/app/consultorias" className="block rounded-xl px-2 py-4 hover:bg-surface-container-high">Gerenciar consultorias →</Link><Link href="/login-methods" className="block rounded-xl px-2 py-4 hover:bg-surface-container-high">Métodos de login →</Link></section>
			<section className="mt-6 border-t border-outline-variant/50 pt-5"><Button type="button" variant="outline" className="w-full border-error/50 text-error hover:border-error hover:bg-error-container/20 hover:text-error" onClick={handleLogout}><RiLogoutBoxRLine size={20} aria-hidden />Sair da conta</Button></section>
		</section>}

		<Modal isOpen={profileOpen} title="Alterar dados pessoais" description="Atualize as informações exibidas no seu perfil." onClose={() => setProfileOpen(false)}><form className="space-y-5" onSubmit={saveProfile}><div className="grid gap-4 sm:grid-cols-2"><Input label="Nome completo" required value={profile.name} disabled={savingProfile} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /><Input label="E-mail" type="email" required leadingIcon={<RiMailLine />} value={profile.email} disabled hint="O e-mail não pode ser alterado." /><Input label="Telefone" type="tel" leadingIcon={<RiPhoneLine />} mask={PHONE_MASK_REGEX} value={profile.phone} disabled={savingProfile} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /><Input label="CPF" mask={CPF_MASK_REGEX} value={profile.document} disabled={savingProfile || documentLocked} hint={documentLocked ? 'O documento cadastrado não pode ser alterado.' : 'Informe seu CPF para completar o cadastro.'} onChange={(event) => setProfile((current) => ({ ...current, document: event.target.value }))} /></div>{profileError && <ErrorBox message={profileError} />}<div className="flex justify-end gap-3 border-t border-outline-variant pt-5"><Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>Cancelar</Button><Button type="submit" disabled={savingProfile}><RiSaveLine aria-hidden />{savingProfile ? 'Salvando...' : 'Salvar dados'}</Button></div></form></Modal>

	</section>;
}
