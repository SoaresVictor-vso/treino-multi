'use client';
import AthletesClient from './AthletesClient';
import { useSession } from '@/hooks/useSession';
import { Role } from '@/lib/roles';
import { useState } from 'react';
import TenantSelector from './TenantSelector';

export default function AthletesPage() {
	const user = useSession();
	const roles = user?.roles ?? [];
	const isOrgAdmin = roles.includes(Role.ORG_ADMIN) && !user?.tenantId;
	const [selectedTenantId, setSelectedTenantId] = useState('');
	if (!user) return null;

	return (
		<>
			{isOrgAdmin && <div className="mx-auto max-w-4xl px-4 pt-6"><TenantSelector value={selectedTenantId} onChange={setSelectedTenantId} /></div>}
		<AthletesClient
			key={isOrgAdmin ? selectedTenantId : 'tenant-session'}
			tenantId={isOrgAdmin ? selectedTenantId : undefined}
			requiresTenantSelection={isOrgAdmin}
			canManage={roles.some((role) =>
				[Role.TENANT_ADMIN, Role.TENANT_TRAINER_MASTER].includes(
					role,
				),
			)}
			canAssignWorkouts={roles.some((role) =>
				[
					Role.TENANT_ADMIN,
					Role.TENANT_TRAINER_MASTER,
					Role.TENANT_TRAINER,
				].includes(role),
			)}
			canRegisterPersonalRecord={roles.some((role) =>
				[
					Role.TENANT_ADMIN,
					Role.TENANT_TRAINER_MASTER,
					Role.TENANT_TRAINER,
				].includes(role),
			)}
		/>
		</>
	);
}
