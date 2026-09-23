import { API_URL } from '@/lib/constants';
import { clearAuthCookie, getAuthToken, setAuthCookie } from '@/lib/auth';

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	currentState?: T;
	error?: string;
	status: number;
}

const MINIMUM_TOKEN_LIFETIME_SECONDS = 60;
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const REMEMBER_ME_KEY = 'rememberMe';
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';
export const API_ERROR_EVENT = 'api:error';
let refreshPromise: Promise<ApiResponse<{ accessToken: string }>> | null = null;
let inMemoryRefreshToken: string | null = null;
let sessionExpirationReported = false;

export function storeSessionTokens(
	accessToken: string,
	refreshToken: string,
): void {
	setAuthCookie(accessToken);
	inMemoryRefreshToken = refreshToken;
	if (typeof sessionStorage !== 'undefined')
		sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
	sessionExpirationReported = false;
}

export function clearSessionTokens(): void {
	inMemoryRefreshToken = null;
	refreshPromise = null;
	clearAuthCookie();

	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(ACCESS_TOKEN_KEY);
		localStorage.removeItem(REFRESH_TOKEN_KEY);
		localStorage.removeItem(REMEMBER_ME_KEY);
	}

	if (typeof sessionStorage !== 'undefined') {
		sessionStorage.removeItem(REFRESH_TOKEN_KEY);
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

function getRefreshToken(): string | null {
	if (inMemoryRefreshToken) return inMemoryRefreshToken;
	const persistedValue =
		typeof localStorage !== 'undefined'
			? localStorage.getItem(REFRESH_TOKEN_KEY)
			: null;
	const sessionValue =
		typeof sessionStorage !== 'undefined'
			? sessionStorage.getItem(REFRESH_TOKEN_KEY)
			: null;
	const value = persistedValue || sessionValue;
	if (!value) return null;

	// usePersistedState persists strings with JSON.stringify(), so older
	// entries may be stored as `"token"` instead of `token`.
	try {
		const parsedValue: unknown = JSON.parse(value);
		return typeof parsedValue === 'string' ? parsedValue : null;
	} catch {
		// Keep compatibility with values stored directly in localStorage.
		return value;
	}
}

export function hasStoredRefreshToken(): boolean {
	return !!getRefreshToken();
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

export async function refreshAccessToken(): Promise<
	ApiResponse<{ accessToken: string }>
> {
	if (!refreshPromise) {
		const refreshToken = getRefreshToken();
		refreshPromise = refreshToken
			? apiRequest<{ accessToken: string }>(
					'auth/refresh',
					{
						method: 'POST',
						body: JSON.stringify({ refreshToken }),
					},
					false,
				)
			: Promise.resolve({
					success: false,
					error: 'Sessão expirada. Faça login novamente.',
					status: 401,
				});
	}

	try {
		const response = await refreshPromise;
		if (response.success && response.data?.accessToken) {
			setAuthCookie(response.data.accessToken);
		}
		return response;
	} finally {
		refreshPromise = null;
	}
}

export async function apiRequest<T>(
	endpoint: string,
	options?: RequestInit,
	reportErrors = true,
): Promise<ApiResponse<T>> {
	try {
		const res = await fetch(`${API_URL}/${endpoint}`, {
			...options,
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
			reportSessionExpired();
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
		reportSessionExpired();
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
