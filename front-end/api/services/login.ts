import { apiRequest } from "../client";
import { LoginRequest, LoginResponse } from "../types/login";

export class LoginService {
    private readonly apiUrl = 'auth/login';

    async login(identifier: string, password: string) {
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

        return response;
    }
}