import { authenticatedRequest } from '../client';
export type AssociationStatus = 'pending' | 'active' | 'rejected' | 'cancelled';
export type ReadScope = 'PRESCRIBED_BY_TENANT' | 'PRESCRIBED_BY_TENANT_LIFETIME' | 'TENANT_AND_ATHLETE' | 'ALL_WORKOUTS';
export interface Association {
  id: string; tenantName: string; status: AssociationStatus; scope: ReadScope;
  invitedAt: string; expiresAt: string; startedAt: string | null; endedAt: string | null;
  previousContract: boolean;
  trainers: { name: string; startDate: string; endDate: string | null }[];
}
export interface TenantHistory {
  id?: string; status: string; scope: ReadScope; invitedAt: string; startedAt: string | null; endedAt: string | null;
  athleteName: string; invitedEmail: string | null; events: { type: string; at: string; actorRole: string }[];
}
const base = 'athlete-tenant-associations';
export const associationsService = {
  mine: () => authenticatedRequest<Association[]>(`${base}/mine`),
  decide: (id: string, accept: boolean) => authenticatedRequest(`${base}/${id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' }),
  endMine: (id: string) => authenticatedRequest(`${base}/${id}/end-mine`, { method: 'POST' }),
  scope: (id: string, scope: ReadScope) => authenticatedRequest(`${base}/${id}/scope`, { method: 'PATCH', body: JSON.stringify({ scope }) }),
  invite: (email: string, password: string) => authenticatedRequest(`${base}/invite`, { method: 'POST', body: JSON.stringify({ email, password }) }),
  revoke: (id: string) => authenticatedRequest(`${base}/${id}/revoke`, { method: 'POST' }),
  tenantActive: () => authenticatedRequest<{ id: string; athleteName: string; startedAt: string }[]>(`${base}/tenant-active`),
  tenantHistory: () => authenticatedRequest<TenantHistory[]>(`${base}/tenant-history`),
  endTenant: (id: string, password: string) => authenticatedRequest(`${base}/${id}/end-tenant`, { method: 'POST', body: JSON.stringify({ password }) }),
};
