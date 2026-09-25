import { Role } from './roles';

interface JwtPayload { sub: string; name?: string | null; roles: Role[]; tenantId: string | null; exp: number }
export interface SessionUser { sub: string; name: string | null; roles: Role[]; tenantId: string | null }
const OFFLINE_USER_KEY = 'treino-multi-offline-user';

// The access token belongs to this JS runtime only. A new tab or reload starts empty.
let accessToken: string | null = null;
export function setAuthCookie(token: string): void { accessToken = token; }
export function clearAuthCookie(): void { accessToken = null; }
export function getAuthToken(): string | null { return accessToken; }
export function getSessionUser(): SessionUser | null {
  if (!accessToken) {
    if (typeof localStorage === 'undefined') return null;
    try {
      const cached = JSON.parse(localStorage.getItem(OFFLINE_USER_KEY) ?? 'null') as SessionUser | null;
      return cached?.sub && cached.roles?.length ? cached : null;
    } catch { return null; }
  }
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
    return { sub: payload.sub, name: payload.name ?? null, roles: payload.roles ?? [], tenantId: payload.tenantId ?? null };
  } catch { return null; }
}
export function rememberOfflineUser(): void {
  const user = getSessionUser();
  if (user && typeof localStorage !== 'undefined') localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(user));
}
export function clearOfflineUser(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(OFFLINE_USER_KEY);
}
export function getRememberedOfflineUserId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try { return (JSON.parse(localStorage.getItem(OFFLINE_USER_KEY) ?? 'null') as SessionUser | null)?.sub ?? null; }
  catch { return null; }
}
