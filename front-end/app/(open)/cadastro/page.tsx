'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ATHLETE_SELF_REGISTRATION_ENABLED } from '@treino-multi/shared';
import { apiRequest } from '@/gateway/client';

export default function AthleteSignup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (!ATHLETE_SELF_REGISTRATION_ENABLED) return <main className="mx-auto max-w-md p-8">Autocadastro indisponível. <Link href="/login">Entrar</Link></main>;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) { setError('As senhas não conferem.'); return; }
    setLoading(true); setError('');
    const result = await apiRequest('auth/athlete-signup', { method: 'POST',
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }) }, false);
    setLoading(false);
    if (!result.success) { setError(result.error || 'Não foi possível criar sua conta.'); return; }
    router.replace('/login');
  };
  return <main className="min-h-screen flex items-center justify-center px-4"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container p-8 shadow-md">
    <h1 className="text-2xl font-bold">Criar conta de atleta</h1>
    <label className="block text-sm">Nome<input required minLength={2} value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3" /></label>
    <label className="block text-sm">E-mail<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3" /></label>
    <label className="block text-sm">Senha<input required type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3" /></label>
    <label className="block text-sm">Confirmar senha<input required type="password" minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3" /></label>
    {error && <p role="alert" className="text-error">{error}</p>}
    <button disabled={loading} className="w-full rounded-lg bg-primary-container p-3 font-bold text-on-primary-fixed">{loading ? 'Criando…' : 'Criar conta'}</button>
    <Link href="/login" className="block text-center text-sm underline">Voltar para login</Link>
  </form></main>;
}
