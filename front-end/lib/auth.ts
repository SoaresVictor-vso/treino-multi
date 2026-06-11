import { Role } from "./roles";

interface JwtPayload {
  sub: string;
  roles: Role[];
  exp: number;
}

export interface SessionUser {
  sub: string;
  roles: Role[];
}

/** Token fixo utilizado durante o desenvolvimento até o fluxo real de auth estar pronto. */
export function setAuthCookie(token: string): void {
  document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; SameSite=Strict`;
}

export function clearAuthCookie(): void {
  document.cookie = "accessToken=; path=/; max-age=0; SameSite=Strict";
}

export function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getSessionUser(): SessionUser | null {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const encodedPayload = token.split(".")[1];
    const decodedPayload = atob(encodedPayload);
    const payload = JSON.parse(decodedPayload) as JwtPayload;
    return { sub: payload.sub, roles: payload.roles ?? [] };
  } catch {
    return null;
  }
}
