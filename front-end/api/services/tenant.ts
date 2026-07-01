import { TenantListItemDto } from "../dto/tenant/list-tenant.dto";
import { authenticatedRequest } from "../client";
import { CreateTenantAdminDto } from "../dto/tenant/create-tenant-admin.dto";
import { CreateTenantDto } from "../dto/tenant/create-tenant.dto";

export type paramsFindMultiple = {
    filter?: "all" | "name";
    name?: string;
    includeInactive?: boolean;
    page?: number;
    limit?: number;
};

export class TenantService {
    private readonly apiUrl = 'tenants';

    async findMultiple(params: paramsFindMultiple) {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") return;
            searchParams.set(key, String(value));
        });

        return authenticatedRequest<TenantListItemDto[]>(`${this.apiUrl}?${searchParams.toString()}`, {
            method: 'GET',
        });
    }

    async create(tenant: CreateTenantDto, admin: CreateTenantAdminDto) {
        return authenticatedRequest<TenantListItemDto>(this.apiUrl, {
            method: "POST",
            body: JSON.stringify({ tenant, admin }),
        });
    }
}
