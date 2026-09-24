'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { associationsService, type Association, type ReadScope } from '@/gateway/services/associations';

const notice = 'Ao encerrar o vínculo, esta consultoria deixará de ver seus treinos e suas métricas pessoais. Você continuará podendo vê-los. Os indicadores agregados históricos da consultoria continuarão considerando seu período de atendimento.';
const scopeLabels: Record<ReadScope, string> = {
  PRESCRIBED_BY_TENANT: 'Prescrições deste contrato',
  PRESCRIBED_BY_TENANT_LIFETIME: 'Todas as prescrições desta consultoria',
  TENANT_AND_ATHLETE: 'Prescrições deste contrato e meus treinos',
  ALL_WORKOUTS: 'Todos os meus treinos',
};
const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value)) : '—';

export default function ConsultoriasPage() {
  const [episodes, setEpisodes] = useState<Association[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const load = async () => {
    const result = await associationsService.mine();
    if (result.success && result.data) setEpisodes(result.data);
    else setMessage(result.error || 'Não foi possível carregar seus vínculos.');
  };
  useEffect(() => { void load(); }, []);
  const decide = async (episode: Association, accept: boolean) => {
    setBusy(episode.id); setMessage('');
    const result = await associationsService.decide(episode.id, accept);
    setBusy(null); setMessage(result.success ? (accept ? 'Convite aceito.' : 'Convite recusado.') : result.error || 'Ação não concluída.');
    await load();
  };
  const end = async (episode: Association) => {
    if (!window.confirm(notice)) return;
    setBusy(episode.id); setMessage('');
    const result = await associationsService.endMine(episode.id);
    setBusy(null); setMessage(result.success ? 'Vínculo encerrado.' : result.error || 'Não foi possível encerrar.');
    await load();
  };
  const changeScope = async (episode: Association, scope: ReadScope) => {
    setBusy(episode.id); setMessage('');
    const result = await associationsService.scope(episode.id, scope);
    setBusy(null); setMessage(result.success ? 'Acesso atualizado.' : result.error || 'Acesso não atualizado.');
    await load();
  };
  return <section className="mx-auto max-w-3xl space-y-5 p-4">
    <Link href="/app/perfil" className="text-sm underline">Voltar ao perfil</Link>
    <h1 className="text-2xl font-bold">Gerenciar consultorias</h1>
    {message && <p role="status" className="rounded-lg bg-surface-container p-3">{message}</p>}
    {!episodes.length && <p>Você ainda não tem vínculos ou convites.</p>}
    {episodes.map(episode => <article key={episode.id} className="space-y-3 rounded-2xl bg-surface-container p-5">
      <div className="flex justify-between gap-3"><h2 className="font-semibold">{episode.tenantName}</h2><span className="text-sm capitalize">{episode.status}</span></div>
      <p className="text-sm">Convite: {date(episode.invitedAt)} · Início: {date(episode.startedAt)} · Fim: {date(episode.endedAt)}</p>
      {episode.status === 'pending' && <><p className="text-sm">Disponível até {date(episode.expiresAt)}</p><div className="flex gap-3"><button disabled={busy === episode.id} onClick={() => void decide(episode, true)} className="rounded-lg bg-primary-container px-4 py-2 text-on-primary-fixed">Aceitar</button><button disabled={busy === episode.id} onClick={() => void decide(episode, false)} className="rounded-lg border px-4 py-2">Recusar</button></div></>}
      {episode.trainers.length > 0 && <p className="text-sm">Treinadores: {episode.trainers.map(t => t.name).join(', ')}</p>}
      <label className="block text-sm">Leitura pela consultoria
        <select value={episode.scope} disabled={episode.status !== 'active' || busy === episode.id}
          onChange={event => void changeScope(episode, event.target.value as ReadScope)} className="mt-1 w-full rounded-lg bg-surface-container-high p-3">
          {(Object.keys(scopeLabels) as ReadScope[]).filter(scope => scope !== 'PRESCRIBED_BY_TENANT_LIFETIME' || episode.previousContract).map(scope =>
            <option key={scope} value={scope}>{scopeLabels[scope]}</option>)}
        </select>
      </label>
      {episode.status === 'active' && <button disabled={busy === episode.id} onClick={() => void end(episode)} className="rounded-lg border border-error px-4 py-2 text-error">Encerrar vínculo</button>}
    </article>)}
  </section>;
}
