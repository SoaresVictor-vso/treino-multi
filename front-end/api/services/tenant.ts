import { authenticatedRequest } from "../client";
import { CreateTenantAdminDto } from "../dto/tenant/create-tenant-admin.dto";
import { CreateTenantDto } from "../dto/tenant/create-tenant.dto";

export type paramsFindMultiple = {
    filter?: "all" | "name";
    name?: string;
    page?: number;
    limit?: number;
};

export type ResultCreateTenant = {
    error?: string;
    status: number;
    success: boolean;
}

export class TenantService {
    private readonly apiUrl = 'tenants';


    async findMultiple(params: paramsFindMultiple) {
        return authenticatedRequest(`${this.apiUrl}?${new URLSearchParams(params as Record<string, string>).toString()}`, {
            method: 'GET',
        });
    }

    async create(tenant: CreateTenantDto, admin: CreateTenantAdminDto) {
        return authenticatedRequest<ResultCreateTenant>(this.apiUrl, {
            method: "POST",
            body: JSON.stringify({ tenant, admin }),
        });
    }
}
