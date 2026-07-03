import { TenantListItemDto } from "@/api/dto/tenant/list-tenant.dto";
import StatusBadge, { BadgeTypes } from "@/components/ui/Badge";

type TenantStatus = "active" | "inactive" | "archived";

const STATUS_META: Record<
  TenantStatus,
  { label: string; type: BadgeTypes }
> = {
  active: {
    label: "Ativo",
    type: "primary",
  },
  inactive: {
    label: "Inativo",
    type: "secondary",
  },
  archived: {
    label: "Arquivado",
    type: "error",
  },
};

export function getTenantStatus(tenant: TenantListItemDto): TenantStatus {
  if (tenant.deletedAt) return "archived";
  return tenant.isActive ? "active" : "inactive";
}

export default function TenantStatusBadge({ tenant }: { tenant: TenantListItemDto }) {
  const status = getTenantStatus(tenant);
  const meta = STATUS_META[status];

  return <StatusBadge label={meta.label} type={meta.type} />;
}
