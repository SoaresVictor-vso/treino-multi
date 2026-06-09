import { API_URL } from "@/lib/constants";
import { getAuthToken } from "@/lib/auth";

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    status: number;
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
    const token = getAuthToken();
    return apiRequest<T>(endpoint, {
        ...options,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options?.headers,
        },
    });
}