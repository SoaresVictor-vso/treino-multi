'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authenticatedRequest, forgetBrowserSession } from '@/gateway/client';
import GoogleCredentialButton from '@/components/auth/GoogleCredentialButton';
import { UsersService } from '@/gateway/services/users';

type Methods = { passwordAvailable: boolean; providers: string[] };
type GoogleAction = 'link' | 'unlink' | 'set';
const users = new UsersService();

export default function LoginMethodsPage() {
  const router = useRouter();
  const [methods, setMethods] = useState<Methods | null>(null);
  const [action, setAction] = useState<GoogleAction>('link');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [revoke, setRevoke] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const result = await authenticatedRequest<Methods>('auth/methods');
    if (result.success && result.data) { setMethods(result.data); setAction(result.data.passwordAvailable ? 'link' : 'set'); }
    else setMessage(result.error || 'Não foi possível carregar os métodos.');
  };
  useEffect(() => { void load(); }, []);
  const validateNew = () => {
    if (newPassword.length < 8) { setMessage('A senha deve ter pelo menos 8 caracteres.'); return false; }
    if (newPassword !== confirmation) { setMessage('As senhas não conferem.'); return false; }
    return true;
  };
  const onGoogleCredential = async (credential: string) => {
    if (action === 'set' && !validateNew()) return;
    setBusy(true); setMessage('');
    const endpoint = action === 'set' ? 'auth/password/first' : `auth/oauth/${action}`;
    const result = await authenticatedRequest(endpoint, { method: 'POST',
      body: JSON.stringify({ provider: 'google', credential,
        ...(action === 'set' ? { newPassword, revokeAllSessions: revoke } : {}) }) });
    setBusy(false);
    if (!result.success) { setMessage(result.error || 'Ação não concluída.'); return; }
    if (action === 'set' && revoke) { await forgetBrowserSession(); router.replace('/login'); return; }
    setNewPassword(''); setConfirmation('');
    setMessage(action === 'link' ? 'Google vinculado.' : action === 'unlink' ? 'Google desvinculado.' : 'Senha definida.');
    await load();
  };
  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateNew()) return;
    setBusy(true); setMessage('');
    const result = await users.changeMyPassword({ currentPassword, newPassword, revokeAllSessions: revoke });
    setBusy(false);
    if (!result.success) { setMessage(result.error || 'Senha não alterada.'); return; }
    if (revoke) { await forgetBrowserSession(); router.replace('/login'); return; }
    setCurrentPassword(''); setNewPassword(''); setConfirmation('');
    setMessage('Senha alterada.'); await load();
  };
  return <section className="mx-auto max-w-2xl space-y-6 p-4">
    <Link href="/app/perfil" className="text-sm underline">Voltar ao perfil</Link>
    <h1 className="text-2xl font-bold">Métodos de login</h1>
    {!methods ? <p>Carregando…</p> : <>
      <p>Senha: {methods.passwordAvailable ? 'disponível' : 'não definida'}</p>
      <p>Google: {methods.providers.includes('google') ? 'vinculado' : 'não vinculado'}</p>
      {methods.passwordAvailable ? <form onSubmit={changePassword} className="space-y-3 rounded-2xl bg-surface-container p-5">
        <h2 className="font-semibold">Redefinir senha</h2>
        <label className="block">Senha atual<input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3" /></label>
        <label className="block">Nova senha<input type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3" /></label>
        <label className="block">Confirmar nova senha<input type="password" required minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3" /></label>
        <label className="flex gap-2"><input type="checkbox" checked={revoke} onChange={e => setRevoke(e.target.checked)} /> Revogar todas as sessões</label>
        <button disabled={busy} className="rounded-lg bg-primary-container px-5 py-3 font-bold text-on-primary-fixed">Alterar senha</button>
      </form> : <div className="space-y-3 rounded-2xl bg-surface-container p-5">
        <h2 className="font-semibold">Definir primeira senha</h2>
        <p className="text-sm">Confirme sua identidade pelo Google para criar a senha.</p>
        <label className="block">Nova senha<input type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3" /></label>
        <label className="block">Confirmar nova senha<input type="password" minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3" /></label>
        <label className="flex gap-2"><input type="checkbox" checked={revoke} onChange={e => setRevoke(e.target.checked)} /> Revogar todas as sessões</label>
        <label className="flex gap-2"><input type="radio" checked={action === 'set'} onChange={() => setAction('set')} /> Definir senha com Google</label>
      </div>}
      <div className="space-y-3 rounded-2xl bg-surface-container p-5">
        <h2 className="font-semibold">Google</h2>
        {!methods.providers.includes('google') && <label className="flex gap-2"><input type="radio" checked={action === 'link'} onChange={() => setAction('link')} /> Vincular Google</label>}
        {methods.providers.includes('google') && <label className="flex gap-2"><input type="radio" checked={action === 'unlink'} onChange={() => setAction('unlink')} /> Desvincular Google após reautenticação</label>}
        <GoogleCredentialButton onCredential={onGoogleCredential} />
      </div>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
