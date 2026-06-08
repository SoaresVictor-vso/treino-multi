import usePersistedState from "@/hooks/usePersistedState";
import { apiRequest } from "../client";
import { LoginRequest, LoginResponse } from "../types/login";

export class LoginService {
    private readonly apiUrl = 'auth/login';

    async login(identifier: string, password: string) {
        const [_, setAccessToken] = usePersistedState<string | null>('accessToken', null);
        const [__, setRefreshToken] = usePersistedState<string | null>('refreshToken', null);

        const payload: LoginRequest = {
            login: identifier,
            password
        };

        const response = await apiRequest<LoginResponse>(this.apiUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.success)
            return response;

        setAccessToken(response.data!.accessToken);
        setRefreshToken(response.data!.refreshToken);

        return response;
    }
}