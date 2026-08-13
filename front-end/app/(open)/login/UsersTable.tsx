import EntityTableShell from '@/components/shared/table/EntityTableShell';
import Button from '@/components/ui/Button';
import { UserListItemDto } from '@/gateway/dto/user/list-user.dto';
import { RiUser3Line, RiEyeLine, RiEditLine } from 'react-icons/ri';
import Badge, { BadgeTypes } from '../../../components/ui/Badge';
import { mask } from '@/lib/tools';

type UsersTableProps = {
	users: UserListItemDto[];
	onView?: (user: UserListItemDto) => void;
	onEdit?: (user: UserListItemDto) => void;
};

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-outline-variant bg-surface-variant/20 text-primary-fixed-dim">
				<RiUser3Line size={24} />
			</div>
			<div className="space-y-1">
				<h3 className="text-lg font-semibold text-primary">
					Nenhum usuário encontrado
				</h3>
				<p className="max-w-md text-sm text-on-surface-variant">
					Ajuste os filtros ou cadastre um novo usuário para preencher a listagem.
				</p>
			</div>
		</div>
	);
}

function RoleLabel({ roles }: { roles: { role: string }[] }) {
	return (
		<span className="rounded-full bg-surface-variant/20 px-3 py-1 text-xs text-primary">
			{roles[0]?.role || 'Sem role'}
		</span>
	);
}

export default function UsersTable({ users, onView, onEdit }: UsersTableProps) {
	const sortedUsers = [...users].sort(
		(a, b) => Number(b.isActive) - Number(a.isActive),
	);
	if (!users.length) {
		return (
			<EntityTableShell
				title="Listagem de usuários"
				subtitle="Directory"
				emptyState={<EmptyState />}
			>
				{null}
			</EntityTableShell>
		);
	}

	console.log('users', users);

	return (
		<EntityTableShell
			title="Listagem de usuários"
			subtitle="Directory"
			emptyState={null}
		>
			<div className="divide-y divide-outline-variant/40 md:hidden">
				{sortedUsers.map((user) => (
					<article key={user.id} className="space-y-4 px-5 py-5">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate text-base font-semibold text-primary">
									{user.person.name}
								</p>
								<p className="truncate text-xs uppercase tracking-[0.16em] text-on-surface-variant">
									{user.person.email || 'Sem e-mail'}
								</p>
							</div>
							<div className="flex flex-wrap justify-end gap-2">
								<Badge
									label={user.isActive ? 'Ativo' : 'Inativo'}
									type={user.isActive ? 'primary' : 'error'}
								/>
								<RoleLabel roles={user.userRoles} />
							</div>
						</div>
						<div className="grid gap-3 text-sm text-on-surface-variant">
							<div>
								<p className="type-label-caps text-secondary-fixed-dim">Documento</p>
								<p>{user.person.document || 'Sem documento'}</p>
							</div>
							<div>
								<p className="type-label-caps text-secondary-fixed-dim">Tenant</p>
								<p>{user.tenant?.tradeName || user.tenant?.name || 'Viso.dev'}</p>
							</div>
							<div>
								<p className="type-label-caps text-secondary-fixed-dim">Contexto</p>
								<p>{user.context}</p>
							</div>
						</div>
					</article>
				))}
			</div>
			<div className="hidden overflow-x-auto md:block">
				<table className="min-w-full border-collapse text-left">
					<thead>
						<tr className="border-b border-outline-variant/70 bg-surface-variant/10">
							<th className="px-6 py-4 type-label-caps text-secondary-fixed-dim">
								Usuário
							</th>
							<th className="px-6 py-4 type-label-caps text-secondary-fixed-dim">
								Tenant
							</th>
							<th className="px-6 py-4 type-label-caps text-secondary-fixed-dim">
								Status e perfil
							</th>
							<th className="px-6 py-4 text-right type-label-caps text-secondary-fixed-dim">
								Acoes
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-outline-variant/30">
						{sortedUsers.map((user) => (
							<tr
								key={user.id}
								className="transition-colors hover:bg-surface-variant/10"
							>
								<td className="px-6 py-4">
									<div className="space-y-1">
										<p className="font-medium text-primary">{user.person.name}</p>
										<p className="text-sm text-on-surface-variant">
											{user.person.email || 'Sem e-mail'}
										</p>
										<p className="text-sm text-on-surface-variant">
											{user.person.phone || 'Sem telefone'}
										</p>
										<p className="text-sm text-on-surface-variant">
											{mask(user.person.document, 'cpf') || 'Sem documento'}
										</p>
									</div>
								</td>
								<td className="px-6 py-4 text-sm text-on-surface-variant">
									{user.tenant?.tradeName || user.tenant?.name || 'Sem tenant'}
								</td>
								<td className="px-6 py-4">
									<RoleBadges
										roles={user.userRoles}
										userId={user.id}
										isActive={user.isActive}
									/>
								</td>
								<td className="px-6 py-4 text-right">
									<Button
										variant="ghost"
										size="icon"
										title="Visualizar"
										onClick={() => onView?.(user)}
									>
										<RiEyeLine size={18} />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										title="Editar"
										onClick={() => onEdit?.(user)}
									>
										<RiEditLine size={18} />
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</EntityTableShell>
	);
}

function RoleBadges({
	roles,
	userId,
	isActive,
}: {
	roles: { role: string }[];
	userId: string;
	isActive: boolean;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			<Badge
				label={isActive ? 'Ativo' : 'Inativo'}
				type={isActive ? 'primary' : 'error'}
			/>
			{roles.map((r) => {
				let type: BadgeTypes = 'secondary';

				if (r.role.startsWith('org')) type = 'error';
				else if (r.role.endsWith('admin')) type = 'primary';

				return <Badge key={r.role + userId} label={r.role} type={type} />;
			})}
		</div>
	);
}
