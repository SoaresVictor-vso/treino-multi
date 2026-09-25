import { enums } from '@treino-multi/shared';
const { Role: SharedRole } = enums;
type SharedRole = enums.Role;


// '*' is a frontend route marker and is never a persisted or authorized role.
export const Role = { ...SharedRole, ALL: '*' } as const;
export type Role = SharedRole;
export type RouteRole = Role | typeof Role.ALL;
