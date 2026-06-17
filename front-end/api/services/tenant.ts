import { apiRequest } from "../client";

export type paramsFindMultiple = {
    filter?: "all" | "name";
    name?: string;
    page?: number;
    limit?: number;
};

export class TenantService {
    private readonly apiUrl = 'tenants';


    async findMultiple(params: paramsFindMultiple) {
        return apiRequest(`${this.apiUrl}?${new URLSearchParams(params as Record<string, string>).toString()}`, {
            method: 'GET',
        });
    }
}