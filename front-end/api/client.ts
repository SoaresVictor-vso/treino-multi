import { API_URL } from "@/lib/constants";
import { getAuthToken, setAuthCookie } from "@/lib/auth";

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    status: number;
}

const MINIMUM_TOKEN_LIFETIME_SECONDS = 60;
let refreshPromise: Promise<ApiResponse<{ accessToken: string }>> | null = null;

function tokenHasEnoughLifetime(token: string | null): boolean {
    if (!token) return false;

    try {
        const payload = token.split('.')[1];
        if (!payload) return false;

        const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decodedPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='));
        const { exp } = JSON.parse(decodedPayload) as { exp?: unknown };

        return typeof exp === 'number' && exp > Math.floor(Date.now() / 1000) + MINIMUM_TOKEN_LIFETIME_SECONDS;
    } catch {
        return false;
    }
}

function getRefreshToken(): string | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("refreshToken");
}

async function refreshAccessToken(): Promise<ApiResponse<{ accessToken: string }>> {
    if (!refreshPromise) {
        const refreshToken = getRefreshToken();
        refreshPromise = refreshToken
            ? apiRequest<{ accessToken: string }>("auth/refresh", {
                method: "POST",
                body: JSON.stringify({ refreshToken }),
            })
            : Promise.resolve({
                success: false,
                error: "Sessão expirada. Faça login novamente.",
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
    options?: RequestInit
): Promise<ApiResponse<T>> {
    try {
        const res = await fetch(`${API_URL}/${endpoint}`, {
            ...options,
            headers: { "Content-Type": "application/json", ...options?.headers },
        });

        const contentType = res.headers.get("Content-Type") || "";

        const data = contentType.includes("application/json") ?
            await res.json() :
            await res.text();

        if (!res.ok) return {
            success: false,
            error: data?.message || "Não foi possível realizar a operação.",
            status: res.status
        };


        return { success: true, data, status: res.status };
    } catch (error) {
        return { success: false, error: "Não foi possível conectar ao servidor.", status: 0 };
    }
}

export async function authenticatedRequest<T>(
    endpoint: string,
    options?: RequestInit
): Promise<ApiResponse<T>> {
    let token = getAuthToken();

    if (!tokenHasEnoughLifetime(token)) {
        const refreshResponse = await refreshAccessToken();
        if (!refreshResponse.success || !refreshResponse.data?.accessToken) {
            return {
                success: false,
                error: refreshResponse.error || "Sessão expirada. Faça login novamente.",
                status: refreshResponse.status || 401,
            };
        }
        token = refreshResponse.data.accessToken;
    }

    return apiRequest<T>(endpoint, {
        ...options,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options?.headers,
        },
    });
}
