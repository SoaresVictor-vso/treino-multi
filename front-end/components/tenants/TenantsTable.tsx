import { TenantListItemDto } from "@/api/dto/tenant/list-tenant.dto";
import Button from "@/components/ui/Button";
import { RiBox3Line, RiBuildingLine, RiEditLine, RiEyeLine, RiMore2Fill } from "react-icons/ri";
import TenantStatusBadge from "./TenantStatusBadge";

type TenantsTableProps = {
  tenants: TenantListItemDto[];
  onViewTenant: (tenant: TenantListItemDto) => void;
  onEditTenant: (tenant: TenantListItemDto) => void;
};

function formatPhone(phone: string | null) {
  if (!phone) return "Sem telefone";

  const digits = phone.replace(/\D/g, "");

  if (digits.length !== 11) return phone;

  return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
}

function formatCnpj(cnpj: string | null) {
  if (!cnpj) return "Sem CNPJ";

  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-outline-variant bg-surface-variant/20 text-primary-fixed-dim">
        <RiBox3Line size={24} />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-primary">Nenhum tenant encontrado</h3>
        <p className="max-w-md text-sm text-on-surface-variant">
          Ajuste os filtros ou cadastre um novo tenant para preencher a listagem.
        </p>
      </div>
    </div>
  );
}

function TenantIdentity({ tenant }: { tenant: TenantListItemDto }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant bg-surface-variant/20 text-primary-fixed-dim">
        <RiBuildingLine size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-primary">{tenant.tradeName || tenant.name}</p>
        <p className="truncate text-xs uppercase tracking-[0.16em] text-on-surface-variant">{tenant.slug}</p>
      </div>
    </div>
  );
}

function TenantActions(props: {
  tenant: TenantListItemDto;
  onViewTenant: (tenant: TenantListItemDto) => void;
  onEditTenant: (tenant: TenantListItemDto) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        title="Visualizar"
        onClick={() => props.onViewTenant(props.tenant)}
      >
        <RiEyeLine size={18} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Editar"
        onClick={() => props.onEditTenant(props.tenant)}
      >
        <RiEditLine size={18} />
      </Button>
      <Button variant="ghost" size="icon" title="Mais acoes">
        <RiMore2Fill size={18} />
      </Button>
    </div>
  );
}

export default function TenantsTable({ tenants, onViewTenant, onEditTenant }: TenantsTableProps) {
  if (!tenants.length) {
    return (
      <section className="overflow-hidden rounded-[20px] border border-outline-variant bg-surface-container shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <EmptyState />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-outline-variant bg-surface-container shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="border-b border-outline-variant bg-surface-variant/10 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="type-label-caps text-secondary-fixed-dim">Directory</p>
            <h3 className="text-lg font-semibold text-primary">Listagem de tenants</h3>
          </div>
          <p className="hidden text-sm text-on-surface-variant md:block">Visual pensado para leitura rapida e alta densidade.</p>
        </div>
      </div>

      <div className="divide-y divide-outline-variant/40 md:hidden">
        {tenants.map((tenant) => (
          <article key={tenant.id} className="space-y-4 px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <TenantIdentity tenant={tenant} />
              <TenantStatusBadge tenant={tenant} />
            </div>
            <div className="grid gap-3 text-sm text-on-surface-variant">
              <div>
                <p className="type-label-caps text-secondary-fixed-dim">Contato</p>
                <p>{tenant.email || "Sem e-mail"}</p>
                <p>{formatPhone(tenant.phone)}</p>
              </div>
              <div>
                <p className="type-label-caps text-secondary-fixed-dim">Documento</p>
                <p>{formatCnpj(tenant.cnpj)}</p>
              </div>
              <div>
                <p className="type-label-caps text-secondary-fixed-dim">Criado em</p>
                <p>{formatDate(tenant.createdAt)}</p>
              </div>
            </div>
            <TenantActions tenant={tenant} onViewTenant={onViewTenant} onEditTenant={onEditTenant} />
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/70 bg-surface-variant/10">
              <th className="px-6 py-4 type-label-caps text-secondary-fixed-dim">Tenant</th>
              <th className="px-6 py-4 type-label-caps text-secondary-fixed-dim">Contato</th>
              <th className="px-6 py-4 type-label-caps text-secondary-fixed-dim">Documento</th>
              <th className="px-6 py-4 type-label-caps text-secondary-fixed-dim">Criado em</th>
              <th className="px-6 py-4 type-label-caps text-secondary-fixed-dim">Status</th>
              <th className="px-6 py-4 text-right type-label-caps text-secondary-fixed-dim">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="transition-colors hover:bg-surface-variant/10">
                <td className="px-6 py-4">
                  <TenantIdentity tenant={tenant} />
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <p className="text-sm text-primary">{tenant.email || "Sem e-mail"}</p>
                    <p className="text-sm text-on-surface-variant">{formatPhone(tenant.phone)}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-on-surface-variant">{formatCnpj(tenant.cnpj)}</td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <p className="font-mono text-sm text-primary">{formatDate(tenant.createdAt)}</p>
                    <p className="text-xs text-on-surface-variant">
                      Atualizado em {formatDate(tenant.updatedAt)}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <TenantStatusBadge tenant={tenant} />
                </td>
                <td className="px-6 py-4 text-right">
                  <TenantActions tenant={tenant} onViewTenant={onViewTenant} onEditTenant={onEditTenant} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
