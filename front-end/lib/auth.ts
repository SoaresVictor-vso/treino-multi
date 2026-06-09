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
