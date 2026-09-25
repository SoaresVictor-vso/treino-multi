import { types } from '@treino-multi/shared';
type UserContext = types.UserContext;
export type TenantFunction = types.TenantFunction;
import { Role } from '@/lib/roles';



export type CreateUserDto = {
	name: string;
	email: string;
	document?: string | null;
	phone?: string | null;
	tenantId?: string | null;
	context: UserContext;
	password: string;
	isActive?: boolean;
	tenantFunction: TenantFunction | null;
};
