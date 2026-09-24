'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiShieldCheckLine } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import ErrorBox from '@/components/ui/ErrorBox';
import PasswordInput from '@/components/auth/PasswordInput';
import { forgetBrowserSession } from '@/gateway/client';
import { UsersService } from '@/gateway/services/users';

const users = new UsersService();

export default function ChangePasswordForm({ onSuccess, onCancel, onBusyChange }: { onSuccess?: () => void; onCancel?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [revokeAllSessions, setRevokeAllSessions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (passwords.newPassword.length < 8) return setError('A nova senha deve ter pelo menos 8 caracteres.');
    if (passwords.newPassword !== passwords.confirmation) return setError('A confirmação não confere com a nova senha.');
    setSaving(true);
    onBusyChange?.(true);
    setError(null);
    const result = await users.changeMyPassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword, revokeAllSessions });
    setSaving(false);
    onBusyChange?.(false);
    if (!result.success) return setError(result.error || 'Não foi possível alterar sua senha.');
    if (revokeAllSessions) { await forgetBrowserSession(); router.replace('/login'); return; }
    setPasswords({ currentPassword: '', newPassword: '', confirmation: '' });
    setMessage('Senha alterada com sucesso.');
    onSuccess?.();
  }

  return <form className="space-y-5" onSubmit={savePassword}>
    <PasswordInput label="Senha atual" required autoComplete="current-password" value={passwords.currentPassword} disabled={saving} onChange={event => setPasswords(current => ({ ...current, currentPassword: event.target.value }))} />
    <div className="grid gap-4 sm:grid-cols-2">
      <PasswordInput label="Nova senha" required minLength={8} autoComplete="new-password" value={passwords.newPassword} disabled={saving} onChange={event => setPasswords(current => ({ ...current, newPassword: event.target.value }))} />
      <PasswordInput label="Confirmar nova senha" required minLength={8} autoComplete="new-password" value={passwords.confirmation} disabled={saving} onChange={event => setPasswords(current => ({ ...current, confirmation: event.target.value }))} />
    </div>
    <p className="flex items-center gap-2 text-xs text-on-surface-variant"><RiShieldCheckLine size={16} aria-hidden />A nova senha deve ter pelo menos 8 caracteres.</p>
    <Checkbox label="Revogar todas as sessões" checked={revokeAllSessions} disabled={saving} onChange={event => setRevokeAllSessions(event.target.checked)} />
    {error && <ErrorBox message={error} />}
    {message && <p role="status" className="text-sm font-medium text-primary-fixed">{message}</p>}
    <div className="flex justify-end gap-2 border-t border-outline-variant pt-5">{onCancel && <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>}<Button type="submit" disabled={saving}>{saving ? 'Alterando...' : 'Alterar senha'}</Button></div>
  </form>;
}
