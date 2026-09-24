'use client';
import { useEffect, useState } from 'react';
import { RiNotification3Line } from 'react-icons/ri';
import { associationsService, type Association } from '@/gateway/services/associations';

export default function InviteNotifications() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Association[]>([]);
  const [message, setMessage] = useState('');
  const load = async () => {
    const result = await associationsService.mine();
    if (result.success && result.data) setPending(result.data.filter(e => e.status === 'pending'));
  };
  useEffect(() => { void load(); }, []);
  const decide = async (id: string, accept: boolean) => {
    const result = await associationsService.decide(id, accept);
    setMessage(result.success ? accept ? 'Convite aceito.' : 'Convite recusado.' : result.error || 'Ação não concluída.');
    await load();
  };
  return <div className="relative">
    <button type="button" onClick={() => setOpen(value => !value)} aria-label={`Notificações: ${pending.length} convites`} className="relative grid h-12 w-12 place-items-center rounded-2xl border border-primary-container/25 bg-primary-container/10 text-primary-fixed">
      <RiNotification3Line size={24} aria-hidden />{pending.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-error px-1.5 text-xs text-on-error">{pending.length}</span>}
    </button>
    {open && <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-2xl border border-outline-variant bg-surface-container p-4 shadow-xl">
      <h2 className="font-semibold">Convites de consultorias</h2>
      {!pending.length && <p className="text-sm">Nenhum convite pendente.</p>}
      {pending.map(invite => <article key={invite.id} className="space-y-2 rounded-xl bg-surface-container-high p-3">
        <strong>{invite.tenantName}</strong>
        <p className="text-xs">Convidou em {new Date(invite.invitedAt).toLocaleDateString('pt-BR')} · prazo {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}</p>
        <div className="flex gap-2"><button onClick={() => void decide(invite.id, true)} className="rounded-lg bg-primary-container px-3 py-2 text-sm text-on-primary-fixed">Aceitar</button><button onClick={() => void decide(invite.id, false)} className="rounded-lg border px-3 py-2 text-sm">Recusar</button></div>
      </article>)}
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>}
  </div>;
}
