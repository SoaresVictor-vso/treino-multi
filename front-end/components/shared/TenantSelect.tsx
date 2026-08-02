'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import Select, { type SelectProps } from '@/components/ui/Select';
import { TenantService } from '@/api/services/tenant';
import type { TenantListItemDto } from '@/api/dto/tenant/list-tenant.dto';

const tenantService = new TenantService();

type TenantSelectProps = Omit<SelectProps, 'options' | 'onChange'> & {
	onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
	includeAll?: boolean;
	allLabel?: string;
	includeInactive?: boolean;
};

export default function TenantSelect({
	includeAll = false,
	allLabel = 'Todos os tenants',
	includeInactive = false,
	onChange,
	...props
}: TenantSelectProps) {
	const [tenants, setTenants] = useState<TenantListItemDto[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();

	useEffect(() => {
		let active = true;

		const loadTenants = async () => {
			setIsLoading(true);
			const response = await tenantService.findMultiple({
				filter: 'all',
				includeInactive,
			});
			if (!active) return;

			if (response.error) setError('Não foi possível carregar os tenants.');
			else setTenants(response.data ?? []);
			setIsLoading(false);
		};

		loadTenants().catch(() => {
			if (active) {
				setError('Não foi possível carregar os tenants.');
				setIsLoading(false);
			}
		});

		return () => {
			active = false;
		};
	}, [includeInactive]);

	return (
		<Select
			{...props}
			disabled={props.disabled || isLoading}
			error={error ?? props.error}
			onChange={onChange}
			options={[
				...(includeAll ? [{ value: '', label: allLabel }] : []),
				...tenants.map((tenant) => ({
					value: tenant.id,
					label: tenant.tradeName || tenant.name,
				})),
			]}
		/>
	);
}
