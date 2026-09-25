'use server';

import 'server-only';
import { API_ORIGIN } from '@/lib/constants';

export type TenantOption = { id: string; name: string };

/** Busca opções de tenant no backend sem expor a chamada upstream ao navegador. */
export async function searchTenantOptions(accessToken: string, query: string) {
	if (!accessToken || accessToken.length > 8192)
		return { options: null, error: 'Sessão inválida.' };

	try {
		const params = new URLSearchParams({ name: query.trim().slice(0, 80) });
		const response = await fetch(
			`${API_ORIGIN}/tenants/athlete-follow-up-options?${params}`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
				cache: 'no-store',
			},
		);

		if (!response.ok)
			return {
				options: null,
				error:
					response.status === 403
						? 'Acesso não autorizado.'
						: 'Não foi possível buscar os tenants.',
			};

		const options = (await response.json()) as TenantOption[];
		return { options, error: null };
	} catch {
		return { options: null, error: 'Não foi possível buscar os tenants.' };
	}
}
