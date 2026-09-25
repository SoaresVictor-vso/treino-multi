import { API_URL } from '@/lib/constants';
import { clearAuthCookie, clearOfflineUser, getAuthToken, getRememberedOfflineUserId, getSessionUser, rememberOfflineUser, setAuthCookie } from '@/lib/auth';

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	currentState?: T;
	error?: string;
	status: number;
}

const MINIMUM_TOKEN_LIFETIME_SECONDS = 60;
const REMEMBER_ME_KEY = 'rememberMe';
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';
export const API_ERROR_EVENT = 'api:error';
type Refreshed = { accessToken: string; refreshToken: string; rememberMe: boolean };
let refreshPromise: Promise<ApiResponse<Refreshed>> | null = null;
let inMemoryRefreshToken: string | null = null;
let rememberCurrent = false;
let sessionExpirationReported = false;
let accountCacheReset: Promise<void> = Promise.resolve();
let previousAccountId: string | null = null;

export function waitForAccountCacheReset(): Promise<void> { return accountCacheReset; }

export function storeSessionTokens(accessToken: string, refreshToken: string, rememberMe: boolean): void {
  const previousUserId = previousAccountId ?? getRememberedOfflineUserId();
  setAuthCookie(accessToken);
  rememberOfflineUser();
  const nextUserId = getSessionUser()?.sub;
  previousAccountId = nextUserId ?? previousUserId;
  if (previousUserId && nextUserId && previousUserId !== nextUserId) {
    accountCacheReset = accountCacheReset.catch(() => undefined).then(async () => {
      const [{ clearOfflineUserData }, { clearCatalogRows }, { exercisesService }, { metricsService }] = await Promise.all([
        import('@/lib/offline-contingency'), import('@/lib/offline-catalog'), import('@/gateway/services/parametro/exercises'), import('@/gateway/services/parametro/metrics'),
      ]);
      await Promise.all([exercisesService.waitForSync(), metricsService.waitForSync()]);
      await Promise.all([clearOfflineUserData(previousUserId), clearCatalogRows()]);
      localStorage.removeItem('last_sync_exercises');
    });
  }
  rememberCurrent = rememberMe;
  inMemoryRefreshToken = rememberMe ? null : refreshToken;
  if (typeof localStorage !== 'undefined') {
    if (rememberMe) localStorage.setItem(REMEMBER_ME_KEY, 'true');
    else localStorage.removeItem(REMEMBER_ME_KEY);
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('accessToken');
  }
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('refreshToken');
  sessionExpirationReported = false;
}

export function clearSessionTokens(): void {
  previousAccountId = getRememberedOfflineUserId() ?? previousAccountId;
  inMemoryRefreshToken = null;
  rememberCurrent = false;
  refreshPromise = null;
  clearAuthCookie();
  clearOfflineUser();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(REMEMBER_ME_KEY);
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('accessToken');
  }
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('refreshToken');
}

export async function forgetBrowserSession(): Promise<void> {
  await apiRequest('auth/forget-browser', { method: 'POST' }, false);
  clearSessionTokens();
}

export async function logoutSession(): Promise<void> {
  const userId = getSessionUser()?.sub;
  const token = inMemoryRefreshToken;
  try {
    await apiRequest('auth/logout', { method: 'POST', body: JSON.stringify(token ? { refreshToken: token } : {}) }, false);
    if (userId) {
      const { clearOfflineUserData } = await import('@/lib/offline-contingency');
      const { clearCatalogRows } = await import('@/lib/offline-catalog');
      await clearOfflineUserData(userId);
      await clearCatalogRows();
    }
  } finally {
    clearSessionTokens();
  }
}

export function tokenHasEnoughLifetime(token: string | null): boolean {
	if (!token) return false;

	try {
		const payload = token.split('.')[1];
		if (!payload) return false;

		const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
		const decodedPayload = atob(
			normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='),
		);
		const { exp } = JSON.parse(decodedPayload) as { exp?: unknown };

		return (
			typeof exp === 'number' &&
			exp > Math.floor(Date.now() / 1000) + MINIMUM_TOKEN_LIFETIME_SECONDS
		);
	} catch {
		return false;
	}
}

function getRefreshToken(): string | null { return inMemoryRefreshToken; }
export function hasStoredRefreshToken(): boolean {
  return !!inMemoryRefreshToken || (typeof localStorage !== 'undefined' && localStorage.getItem(REMEMBER_ME_KEY) === 'true');
}

function reportSessionExpired(): void {
	if (sessionExpirationReported || typeof window === 'undefined') return;

	sessionExpirationReported = true;
	clearSessionTokens();
	window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

function reportApiError(response: ApiResponse<unknown>): void {
	if (
		response.success ||
		response.status === 401 ||
		typeof window === 'undefined'
	)
		return;
	window.dispatchEvent(
		new CustomEvent(API_ERROR_EVENT, {
			detail: {
				message: response.error || 'Não foi possível realizar a operação.',
			},
		}),
	);
}

export async function refreshAccessToken(): Promise<ApiResponse<Refreshed>> {
  if (!refreshPromise) {
    const rotate = async (): Promise<ApiResponse<Refreshed>> => {
      const remembered = rememberCurrent || (typeof localStorage !== 'undefined' && localStorage.getItem(REMEMBER_ME_KEY) === 'true');
      const refreshToken = getRefreshToken();
      if (!remembered && !refreshToken) return { success: false, error: 'Sessão expirada.', status: 401 };
      const result = await apiRequest<Refreshed>('auth/refresh', {
        method: 'POST', body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      }, false);
      if (result.success && result.data) storeSessionTokens(result.data.accessToken, result.data.refreshToken, result.data.rememberMe);
      return result;
    };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    refreshPromise = locks
      ? (locks.request('auth-refresh', rotate) as unknown as Promise<ApiResponse<Refreshed>>)
      : rotate();
  }
  try { return await refreshPromise!; }
  finally { refreshPromise = null; }
}

export async function apiRequest<T>(
	endpoint: string,
	options?: RequestInit,
	reportErrors = true,
): Promise<ApiResponse<T>> {
	try {
		const res = await fetch(`${API_URL}/${endpoint}`, {
			...options,
			credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
		});

		const contentType = res.headers.get('Content-Type') || '';

		const data = contentType.includes('application/json')
			? await res.json()
			: await res.text();

		if (!res.ok) {
			const response = {
				success: false,
				error: data?.message || 'Não foi possível realizar a operação.',
				currentState: data?.currentState,
				status: res.status,
			};
			if (reportErrors && res.status !== 409) reportApiError(response);
			return response;
		}

		return { success: true, data, status: res.status };
	} catch {
		const response = {
			success: false,
			error: 'Não foi possível conectar ao servidor.',
			status: 0,
		};
		if (reportErrors) reportApiError(response);
		return response;
	}
}

export async function authenticatedRequest<T>(
	endpoint: string,
	options?: RequestInit,
): Promise<ApiResponse<T>> {
	let token = getAuthToken();

	if (!tokenHasEnoughLifetime(token)) {
		const refreshResponse = await refreshAccessToken();
		if (!refreshResponse.success || !refreshResponse.data?.accessToken) {
			if (refreshResponse.status !== 0) reportSessionExpired();
			return {
				success: false,
				error: refreshResponse.error || 'Sessão expirada. Faça login novamente.',
				status: refreshResponse.status || 401,
			};
		}
		token = refreshResponse.data.accessToken;
	}

	const requestWithToken = (accessToken: string) =>
		apiRequest<T>(
			endpoint,
			{
				...options,
				headers: {
					...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
					...options?.headers,
				},
			},
			false,
		);

	const response = await requestWithToken(token || '');
	if (response.status !== 401) {
		reportApiError(response);
		return response;
	}

	// A token can expire between the pre-flight check and the API validation.
	// The rejected request never reached its handler, so retrying it once is safe.
	const refreshResponse = await refreshAccessToken();
	if (!refreshResponse.success || !refreshResponse.data?.accessToken) {
		if (refreshResponse.status !== 0) reportSessionExpired();
		return {
			success: false,
			error: refreshResponse.error || 'Sessão expirada. Faça login novamente.',
			status: refreshResponse.status || 401,
		};
	}

	const retryResponse = await requestWithToken(refreshResponse.data.accessToken);
	if (retryResponse.status === 401) reportSessionExpired();
	else reportApiError(retryResponse);
	return retryResponse;
}
