'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getAuthToken } from '@/lib/auth';
import { searchTenantOptions } from '@/gateway/services/tenant-options';

export default function TenantSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
	const [query, setQuery] = useState('');
	const [options, setOptions] = useState<ReactNode>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let active = true;
		const timer = window.setTimeout(async () => {
			const token = getAuthToken();
			if (!token) return;
			const result = await searchTenantOptions(token, query);
			if (!active) return;
			setOptions(
				result.options?.map((tenant) => (
					<option key={tenant.id} value={tenant.id}>
						{tenant.name}
					</option>
				)) ?? null,
			);
			setError(result.error);
		}, 250);
		return () => { active = false; window.clearTimeout(timer); };
	}, [query]);
	return <div className="space-y-2">
		<label htmlFor="tenant-search" className="block text-sm font-semibold">Buscar tenant</label>
		<input id="tenant-search" value={query} onChange={(event) => { setQuery(event.target.value); onChange(''); }} placeholder="Nome do tenant" className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 py-2" />
		<label htmlFor="tenant-select" className="block text-sm font-semibold">Tenant para acompanhamento</label>
		<select id="tenant-select" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 py-2">
			<option value="">Selecione um tenant</option>
			{options}
		</select>
		{error && <p role="alert" className="text-sm text-error">{error}</p>}
	</div>;
}
