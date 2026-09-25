import { types } from '@treino-multi/shared';
export type UserContext = types.UserContext;
import { Role } from '@/lib/roles';




export interface UserListItemDto {
	id: string;
	personId: string;
	tenantId: string | null;
	context: UserContext;
	isActive: boolean;
	lastLoginAt: string | null;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
	person: {
		id: string;
		name: string;
		email: string | null;
		document: string | null;
		phone: string | null;
	};
	tenant: {
		id: string;
		name: string;
		tradeName: string | null;
		slug: string;
	} | null;
	userRoles: { role: Role }[];
}

export interface UsersListResponseDto {
	data: UserListItemDto[];
	total: number;
	limit: number;
	orderBy: string;
	nextStart: string | null;
}
