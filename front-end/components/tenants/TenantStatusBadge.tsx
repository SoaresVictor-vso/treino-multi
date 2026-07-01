import { TenantListItemDto } from "@/api/dto/tenant/list-tenant.dto";

type TenantStatus = "active" | "inactive" | "archived";

const STATUS_META: Record<
  TenantStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Ativo",
    className: "border-primary-fixed-dim/20 bg-primary-fixed-dim/10 text-primary-fixed-dim",
  },
  inactive: {
    label: "Inativo",
    className: "border-outline-variant/70 bg-surface-variant/40 text-secondary-fixed-dim",
  },
  archived: {
    label: "Arquivado",
    className: "border-error/20 bg-error/10 text-error",
  },
};

export function getTenantStatus(tenant: TenantListItemDto): TenantStatus {
  if (tenant.deletedAt) return "archived";
  return tenant.isActive ? "active" : "inactive";
}

export default function TenantStatusBadge({ tenant }: { tenant: TenantListItemDto }) {
  const status = getTenantStatus(tenant);
  const meta = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center rounded-md border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
