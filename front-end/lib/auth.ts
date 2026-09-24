import { Role } from './roles';

interface JwtPayload { sub: string; name?: string | null; roles: Role[]; tenantId: string | null; exp: number }
export interface SessionUser { sub: string; name: string | null; roles: Role[]; tenantId: string | null }

// The access token belongs to this JS runtime only. A new tab or reload starts empty.
let accessToken: string | null = null;
export function setAuthCookie(token: string): void { accessToken = token; }
export function clearAuthCookie(): void { accessToken = null; }
export function getAuthToken(): string | null { return accessToken; }
export function getSessionUser(): SessionUser | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
    return { sub: payload.sub, name: payload.name ?? null, roles: payload.roles ?? [], tenantId: payload.tenantId ?? null };
  } catch { return null; }
}
