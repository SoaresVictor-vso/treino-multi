import { TenantListItemDto } from "./list-tenant.dto";

export type TenantAdminDetailsDto = {
  name: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
};

export type TenantDetailsDto = TenantListItemDto & {
  admin: TenantAdminDetailsDto | null;
};
