import { TenantDetailsDto } from "../dto/tenant/detail-tenant.dto";
import { TenantListItemDto } from "../dto/tenant/list-tenant.dto";
import { authenticatedRequest } from "../client";
import { CreateTenantAdminDto } from "../dto/tenant/create-tenant-admin.dto";
import { CreateTenantDto } from "../dto/tenant/create-tenant.dto";
import { UpdateTenantDto } from "../dto/tenant/update-tenant.dto";

type TenantDetailsRequest = ReturnType<typeof authenticatedRequest<TenantDetailsDto>>;

export type paramsFindMultiple = {
    filter?: "all" | "name";
    name?: string;
    includeInactive?: boolean;
    page?: number;
    limit?: number;
};

export class TenantService {
    private readonly apiUrl = 'tenants';
    private readonly tenantDetailsInFlight = new Map<string, TenantDetailsRequest>();

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

    async update(id: string, tenant: UpdateTenantDto) {
        return authenticatedRequest<TenantListItemDto>(`${this.apiUrl}/${id}`, {
            method: "PATCH",
            body: JSON.stringify(tenant),
        });
    }

    async findDetails(id: string) {
        const inFlightRequest = this.tenantDetailsInFlight.get(id);

        if (inFlightRequest) {
            return inFlightRequest;
        }

        const request = authenticatedRequest<TenantDetailsDto>(`${this.apiUrl}/${id}/details`, {
            method: "GET",
        }).finally(() => {
            this.tenantDetailsInFlight.delete(id);
        });

        this.tenantDetailsInFlight.set(id, request);

        return request;
    }
}
