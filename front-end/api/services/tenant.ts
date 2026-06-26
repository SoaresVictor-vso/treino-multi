import { authenticatedRequest } from "../client";
import { CreateTenantDto } from "../dto/create-tenant.dto";

export type paramsFindMultiple = {
    filter?: "all" | "name";
    name?: string;
    page?: number;
    limit?: number;
};

export class TenantService {
    private readonly apiUrl = 'tenants';


    async findMultiple(params: paramsFindMultiple) {
        return authenticatedRequest(`${this.apiUrl}?${new URLSearchParams(params as Record<string, string>).toString()}`, {
            method: 'GET',
        });
    }

    async create(dto: CreateTenantDto) {
        return authenticatedRequest(this.apiUrl, {
            method: "POST",
            body: JSON.stringify(dto),
        });
    }
}
